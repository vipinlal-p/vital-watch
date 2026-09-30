"""Create a raster hotspot probability map with a previously trained ANN.

Example:
    python riskmap_ann.py --model ann_results/ann_hotspot_model.joblib \
        --rasters-dir . --study-area studyarea.geojson

The output is a Float32 GeoTIFF of predicted hotspot probabilities (0 to 1),
masked outside the study area, plus a PNG visualization.
"""

from __future__ import annotations

import argparse
import re
from pathlib import Path

import geopandas as gpd
import joblib
import matplotlib.pyplot as plt
import numpy as np
import rasterio
from rasterio.features import geometry_mask
from rasterio.transform import array_bounds
from rasterio.windows import Window, transform as window_transform
from rasterio.warp import Resampling, reproject


def _list_rasters(directory: Path, pattern: str) -> list[Path]:
    if pattern == "*.tif":
        files = [p for suffix in ("*.tif", "*.tiff") for p in directory.rglob(suffix)]
    else:
        files = list(directory.rglob(pattern))
    return sorted(p for p in files if p.is_file())


def _feature_map(raster_files: list[Path], root: Path) -> dict[str, Path]:
    mapped = {}
    for path in raster_files:
        key = path.relative_to(root).with_suffix("").as_posix().replace("/", "__")
        mapped[key] = path
    return mapped


def create_risk_map(
    model_file: str | Path = "ann_results/ann_hotspot_model.joblib",
    study_area_file: str | Path = "studyarea.geojson",
    rasters_dir: str | Path = ".",
    output_file: str | Path = "ann_risk_map.tif",
    plot_file: str | Path = "ann_risk_map.png",
    raster_pattern: str = "*.tif",
    chunk_rows: int = 256,
) -> tuple[Path, Path]:
    """Predict hotspot probabilities in the study area and save map files."""
    root = Path(rasters_dir).expanduser().resolve()
    model_path = Path(model_file).expanduser().resolve()
    study_path = Path(study_area_file).expanduser().resolve()
    if not root.is_dir():
        raise NotADirectoryError(root)
    if not model_path.is_file():
        raise FileNotFoundError(f"ANN model not found: {model_path}")
    if not study_path.is_file():
        raise FileNotFoundError(f"Study area GeoJSON not found: {study_path}")
    if chunk_rows < 1:
        raise ValueError("chunk_rows must be a positive integer")

    artifact = joblib.load(model_path)
    if not isinstance(artifact, dict) or "model" not in artifact or "feature_columns" not in artifact:
        raise ValueError("Model file must be the artifact written by ANN.py")
    model = artifact["model"]
    feature_columns = list(artifact["feature_columns"])
    rasters = _list_rasters(root, raster_pattern)
    if not rasters:
        raise FileNotFoundError(f"No rasters matching {raster_pattern!r} found under {root}")
    raster_by_key = _feature_map(rasters, root)

    # Translate ANN feature names (<relative raster path>__band_<n>) to source
    # rasters and one-based band numbers.
    pattern = re.compile(r"^(?P<key>.+)__band_(?P<band>[1-9][0-9]*)$")
    feature_sources: list[tuple[Path, int]] = []
    missing = []
    for feature in feature_columns:
        match = pattern.match(str(feature))
        if not match:
            raise ValueError(
                f"ANN feature {feature!r} is not a raster band column. Retrain ANN.py using extracted raster features."
            )
        key, band = match.group("key"), int(match.group("band"))
        source = raster_by_key.get(key)
        if source is None:
            missing.append(str(feature))
            continue
        feature_sources.append((source, band))
    if missing:
        raise FileNotFoundError(
            "Could not find rasters for the model feature(s): " + ", ".join(missing)
            + ". Use --rasters-dir pointing to the same raster directory used for feature extraction."
        )

    area = gpd.read_file(study_path)
    if area.empty:
        raise ValueError(f"No geometries found in {study_path}")
    if area.crs is None:
        raise ValueError(f"Study area file has no CRS: {study_path}")
    geometries = [geom for geom in area.geometry if geom is not None and not geom.is_empty]
    if not geometries:
        raise ValueError("Study area has no usable geometries")

    reference_path = rasters[0]
    with rasterio.open(reference_path) as reference:
        if reference.crs is None:
            raise ValueError(f"Reference raster has no CRS: {reference_path}")
        width, height = reference.width, reference.height
        transform, crs = reference.transform, reference.crs
        profile = reference.profile.copy()
    area = area.to_crs(crs)
    geometries = [geom.__geo_interface__ for geom in area.geometry if geom is not None and not geom.is_empty]
    inside_study_area = geometry_mask(
        geometries, out_shape=(height, width), transform=transform, invert=True
    )
    if not inside_study_area.any():
        raise ValueError("The study area does not overlap the reference raster extent")

    output_path = Path(output_file).expanduser()
    plot_path = Path(plot_file).expanduser()
    if not output_path.is_absolute():
        output_path = root / output_path
    if not plot_path.is_absolute():
        plot_path = root / plot_path
    output_path.parent.mkdir(parents=True, exist_ok=True)
    plot_path.parent.mkdir(parents=True, exist_ok=True)

    nodata = -9999.0
    output_profile = profile.copy()
    output_profile.update(driver="GTiff", count=1, dtype="float32", nodata=nodata, compress="deflate")
    valid_pixels = 0
    with rasterio.open(output_path, "w", **output_profile) as destination:
        for row_start in range(0, height, chunk_rows):
            rows = min(chunk_rows, height - row_start)
            window = Window(0, row_start, width, rows)
            chunk_transform = window_transform(window, transform)
            chunk_mask = geometry_mask(
                geometries, out_shape=(rows, width), transform=chunk_transform, invert=True
            )
            positions = np.flatnonzero(chunk_mask)
            probability = np.full((rows, width), nodata, dtype=np.float32)
            if positions.size:
                # One feature column per model input, with rasters reprojected to
                # the reference grid for this chunk if their grids differ.
                values = np.empty((positions.size, len(feature_sources)), dtype=np.float32)
                for column, (source_path, band) in enumerate(feature_sources):
                    with rasterio.open(source_path) as source:
                        if source.crs is None:
                            raise ValueError(f"Raster has no CRS: {source_path}")
                        if band > source.count:
                            raise ValueError(f"Feature requests band {band}, but {source_path} has {source.count} band(s)")
                        warped = np.full((rows, width), np.nan, dtype=np.float32)
                        reproject(
                            source=rasterio.band(source, band),
                            destination=warped,
                            src_transform=source.transform,
                            src_crs=source.crs,
                            src_nodata=source.nodata,
                            dst_transform=chunk_transform,
                            dst_crs=crs,
                            dst_nodata=np.nan,
                            resampling=Resampling.nearest,
                        )
                    values[:, column] = warped.ravel()[positions]
                predicted = model.predict_proba(values)
                classes = list(model.classes_) if hasattr(model, "classes_") else list(model.named_steps["ann"].classes_)
                positive_column = classes.index(1)
                flat_probability = probability.ravel()
                flat_probability[positions] = predicted[:, positive_column]
                valid_pixels += positions.size
            destination.write(probability, 1, window=window)

    # PNG preview. GeoTIFF is the georeferenced output for GIS and analysis.
    with rasterio.open(output_path) as result:
        image = result.read(1, masked=True)
        bounds = result.bounds
    fig, ax = plt.subplots(figsize=(9, 8))
    image_artist = ax.imshow(
        image,
        extent=(bounds.left, bounds.right, bounds.bottom, bounds.top),
        origin="upper",
        cmap="YlOrRd",
        vmin=0,
        vmax=1,
    )
    area.boundary.plot(ax=ax, color="black", linewidth=0.8)
    fig.colorbar(image_artist, ax=ax, label="Predicted hotspot probability")
    ax.set_title("ANN hotspot risk map")
    ax.set_xlabel(f"X ({crs.to_string()})")
    ax.set_ylabel("Y")
    ax.set_aspect("equal")
    fig.tight_layout()
    fig.savefig(plot_path, dpi=180)
    plt.close(fig)

    print(f"Wrote risk probabilities for {valid_pixels:,} study-area pixels to {output_path}")
    print(f"Wrote map preview to {plot_path}")
    return output_path, plot_path


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--model", default="ann_results/ann_hotspot_model.joblib", help="ANN model artifact from ANN.py")
    parser.add_argument("--study-area", default="studyarea.geojson", help="Study area boundary GeoJSON")
    parser.add_argument("--rasters-dir", default=".", help="Root directory containing the source GeoTIFFs")
    parser.add_argument("--output", default="ann_risk_map.tif", help="Output probability GeoTIFF")
    parser.add_argument("--plot", default="ann_risk_map.png", help="Output PNG preview")
    parser.add_argument("--raster-pattern", default="*.tif", help="Recursive source raster pattern")
    parser.add_argument("--chunk-rows", type=int, default=256, help="Rows predicted at a time")
    args = parser.parse_args()
    create_risk_map(
        args.model, args.study_area, args.rasters_dir, args.output, args.plot,
        args.raster_pattern, args.chunk_rows,
    )


if __name__ == "__main__":
    main()
