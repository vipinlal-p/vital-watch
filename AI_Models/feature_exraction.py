"""Extract raster values at hotspot and non-hotspot points.

The resulting table is saved as a Parquet file, which can be loaded from another
Python file with ``pandas.read_parquet``. Requires rasterio, geopandas, pandas,
and a Parquet engine such as pyarrow.
"""

from __future__ import annotations

import argparse
from pathlib import Path
import geopandas as gpd
import numpy as np
import pandas as pd
import rasterio


def _find_one(directory: Path, filename: str) -> Path:
    """Find a named GeoJSON below directory, ignoring filename case."""
    matches = [p for p in directory.rglob("*") if p.is_file() and p.name.lower() == filename.lower()]
    if not matches:
        raise FileNotFoundError(f"Could not find {filename!r} under {directory}")
    if len(matches) > 1:
        raise ValueError(f"Found multiple {filename!r} files: {matches}")
    return matches[0]


def _load_points(path: Path, label: int) -> gpd.GeoDataFrame:
    points = gpd.read_file(path)
    if points.empty:
        raise ValueError(f"No features found in {path}")
    if points.crs is None:
        raise ValueError(f"{path} has no CRS. Define its CRS before extracting raster values.")
    if points.geometry.isna().any() or points.geometry.is_empty.any():
        raise ValueError(f"{path} contains missing or empty geometries")
    if not points.geometry.geom_type.isin(["Point", "MultiPoint"]).all():
        raise ValueError(f"{path} must contain Point or MultiPoint geometries")
    points = points.copy()
    points["hotspot"] = label
    points["source_geojson"] = path.name
    return points


def extract_features(
    data_dir: str | Path = ".",
    hotspot_file: str | Path | None = None,
    non_hotspot_file: str | Path | None = None,
    output_file: str | Path = "raster_point_features.parquet",
    raster_pattern: str = "*.tif",
) -> pd.DataFrame:
    """Sample every matching GeoTIFF at each input point and save a table.

    Point coordinates are reprojected into each raster's CRS. All rasters must
    have a defined, matching CRS. Rasters may have different dimensions and
    resolutions; their own transforms and bounds are used for sampling.
    """
    data_dir = Path(data_dir).expanduser().resolve()
    if not data_dir.is_dir():
        raise NotADirectoryError(data_dir)

    hotspot_path = Path(hotspot_file).expanduser() if hotspot_file else _find_one(data_dir, "hotspot.geojson")
    non_hotspot_path = (
        Path(non_hotspot_file).expanduser()
        if non_hotspot_file
        else _find_one(data_dir, "non_hotspot.geojson")
    )
    if not hotspot_path.is_absolute():
        hotspot_path = data_dir / hotspot_path
    if not non_hotspot_path.is_absolute():
        non_hotspot_path = data_dir / non_hotspot_path

    if raster_pattern == "*.tif":
        rasters = sorted(
            p for suffix in ("*.tif", "*.tiff") for p in data_dir.rglob(suffix) if p.is_file()
        )
    else:
        rasters = sorted(p for p in data_dir.rglob(raster_pattern) if p.is_file())
    if not rasters:
        raise FileNotFoundError(f"No rasters matching {raster_pattern!r} found under {data_dir}")

    hotspot_points = _load_points(hotspot_path, 1)
    non_hotspot_points = _load_points(non_hotspot_path, 0).to_crs(hotspot_points.crs)
    # Keep both sets in a single known CRS for the returned coordinates.
    points = gpd.GeoDataFrame(
        pd.concat([hotspot_points, non_hotspot_points], ignore_index=True),
        geometry="geometry",
        crs=hotspot_points.crs,
    )

    raster_crs = None
    feature_values: dict[str, list] = {}
    raster_metadata: list[dict[str, object]] = []
    for raster_path in rasters:
        with rasterio.open(raster_path) as src:
            if src.crs is None:
                raise ValueError(f"Raster has no CRS: {raster_path}")
            if raster_crs is None:
                raster_crs = src.crs
            elif src.crs != raster_crs:
                raise ValueError(
                    f"Raster CRS mismatch: {raster_path} uses {src.crs}, while earlier rasters use {raster_crs}"
                )
            raster_metadata.append(
                {"file": str(raster_path), "crs": src.crs.to_string(), "width": src.width,
                 "height": src.height, "bands": src.count, "transform": src.transform}
            )
            projected = points.to_crs(src.crs)
            coords = [(geom.x, geom.y) for geom in projected.geometry]
            samples = list(src.sample(coords, indexes=list(range(1, src.count + 1)), masked=True))
            for band in range(1, src.count + 1):
                # Include the relative path to avoid collisions between equal filenames.
                rel = raster_path.relative_to(data_dir).with_suffix("").as_posix().replace("/", "__")
                column = f"{rel}__band_{band}"
                feature_values[column] = [
                    pd.NA if np.ma.is_masked(row[band - 1]) else row[band - 1].item()
                    for row in samples
                ]

    result = pd.DataFrame(points.drop(columns="geometry"))
    result["longitude"] = points.geometry.x
    result["latitude"] = points.geometry.y
    for name, values in feature_values.items():
        result[name] = values
    result["raster_crs"] = raster_crs.to_string()  # type: ignore[union-attr]

    output_path = Path(output_file).expanduser()
    if not output_path.is_absolute():
        output_path = data_dir / output_path
    output_path.parent.mkdir(parents=True, exist_ok=True)
    if output_path.suffix.lower() == ".parquet":
        result.to_parquet(output_path, index=False)
    elif output_path.suffix.lower() == ".csv":
        result.to_csv(output_path, index=False)
    else:
        raise ValueError("Output file must end in .parquet or .csv")
    print(f"Extracted {len(result)} points from {len(rasters)} raster(s).")
    print(f"Raster dimensions: {[(m['file'], m['width'], m['height']) for m in raster_metadata]}")
    print(f"Saved {output_path}")
    return result


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--data-dir", default=".", help="Folder containing GeoJSON and TIFF files")
    parser.add_argument("--hotspot", help="Path to hotspot GeoJSON (default: find hotspot.geojson)")
    parser.add_argument("--non-hotspot", help="Path to non-hotspot GeoJSON (default: find non_hotspot.geojson)")
    parser.add_argument("--output", default="raster_point_features.parquet", help="Output .parquet or .csv path")
    parser.add_argument("--raster-pattern", default="*.tif", help="Recursive raster filename pattern")
    args = parser.parse_args()
    extract_features(args.data_dir, args.hotspot, args.non_hotspot, args.output, args.raster_pattern)


if __name__ == "__main__":
    main()
