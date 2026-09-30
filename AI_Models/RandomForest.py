"""Train and evaluate a random forest from extracted raster features.

Example:
    python RandomForest.py --input raster_point_features.csv

CSV and Parquet feature tables are supported. The script saves a reusable
model, held-out predictions, a metrics report, and four evaluation plots.
"""

from __future__ import annotations

import argparse
from pathlib import Path

import joblib
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.impute import SimpleImputer
from sklearn.metrics import (
    ConfusionMatrixDisplay,
    accuracy_score,
    auc,
    classification_report,
    confusion_matrix,
    roc_curve,
)
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline


TARGET = "hotspot"
NON_FEATURE_COLUMNS = {
    TARGET,
    "geometry",
    "source_geojson",
    "raster_crs",
    "longitude",
    "latitude",
}


def load_table(path: Path) -> pd.DataFrame:
    """Load a CSV or Parquet feature table."""
    if path.suffix.lower() == ".csv":
        return pd.read_csv(path)
    if path.suffix.lower() in {".parquet", ".pq"}:
        return pd.read_parquet(path)
    raise ValueError("Input must be a .csv or .parquet file")


def train_random_forest(
    input_file: str | Path = "raster_point_features.csv",
    output_dir: str | Path = "random_forest_results",
    test_size: float = 0.2,
    random_state: int = 42,
    n_estimators: int = 300,
) -> dict[str, object]:
    """Train the classifier, evaluate on held-out rows, and save artifacts."""
    input_path = Path(input_file).expanduser().resolve()
    # The feature extraction script defaults to Parquet; accept that default
    # automatically when the caller leaves the standard CSV path unchanged.
    if not input_path.exists() and str(input_file) == "raster_point_features.csv":
        parquet_fallback = input_path.with_suffix(".parquet")
        if parquet_fallback.exists():
            input_path = parquet_fallback
    if not input_path.is_file():
        raise FileNotFoundError(f"Feature table not found: {input_path}")

    frame = load_table(input_path)
    if TARGET not in frame.columns:
        raise ValueError(f"Input table must contain a {TARGET!r} target column")
    y = pd.to_numeric(frame[TARGET], errors="coerce")
    if y.isna().any() or not set(y.unique()).issubset({0, 1}):
        raise ValueError("The hotspot column must contain only 0 (non-hotspot) and 1 (hotspot)")
    y = y.astype(int)

    # Extraction names bands <raster>__band_<number>. If a table was manually
    # assembled, fall back to other numeric predictors while excluding metadata.
    feature_columns = [column for column in frame.columns if "__band_" in str(column)]
    if not feature_columns:
        feature_columns = [
            column for column in frame.select_dtypes(include=["number"]).columns
            if column not in NON_FEATURE_COLUMNS
        ]
    if not feature_columns:
        raise ValueError("No numeric raster feature columns were found in the table")
    X = frame[feature_columns].apply(pd.to_numeric, errors="coerce")
    X = X.replace([np.inf, -np.inf], np.nan)
    feature_columns = [column for column in X.columns if X[column].notna().any()]
    X = X[feature_columns]
    if not feature_columns:
        raise ValueError("All candidate feature columns are empty or non-numeric")
    if y.nunique() != 2:
        raise ValueError("Training requires examples from both hotspot classes (0 and 1)")
    if y.value_counts().min() < 2:
        raise ValueError("Each class needs at least two samples for a stratified train/test split")
    if not 0 < test_size < 1:
        raise ValueError("test_size must be between 0 and 1")

    X_train, X_test, y_train, y_test, test_indices = train_test_split(
        X, y, frame.index, test_size=test_size, random_state=random_state, stratify=y
    )
    model = Pipeline(
        steps=[
            ("imputer", SimpleImputer(strategy="median")),
            (
                "forest",
                RandomForestClassifier(
                    n_estimators=n_estimators,
                    class_weight="balanced",
                    random_state=random_state,
                    n_jobs=-1,
                ),
            ),
        ]
    )
    model.fit(X_train, y_train)
    predicted = model.predict(X_test)
    forest = model.named_steps["forest"]
    positive_index = list(forest.classes_).index(1)
    probabilities = model.predict_proba(X_test)[:, positive_index]
    accuracy = accuracy_score(y_test, predicted)
    fpr, tpr, _ = roc_curve(y_test, probabilities)
    roc_auc = auc(fpr, tpr)

    destination = Path(output_dir).expanduser().resolve()
    destination.mkdir(parents=True, exist_ok=True)
    joblib.dump(
        {"model": model, "feature_columns": feature_columns},
        destination / "random_forest_hotspot_model.joblib",
    )

    predictions = frame.loc[test_indices].copy()
    predictions["actual_hotspot"] = y_test.to_numpy()
    predictions["predicted_hotspot"] = predicted
    predictions["hotspot_probability"] = probabilities
    predictions.to_csv(destination / "test_predictions.csv", index=False)

    # Accuracy graph.
    fig, ax = plt.subplots(figsize=(5, 4))
    ax.bar(["Accuracy"], [accuracy], color="#2878B5")
    ax.set_ylim(0, 1)
    ax.set_ylabel("Score")
    ax.set_title(f"Random forest held-out accuracy: {accuracy:.3f}")
    ax.text(0, accuracy + 0.025, f"{accuracy:.3f}", ha="center")
    fig.tight_layout()
    fig.savefig(destination / "accuracy.png", dpi=160)
    plt.close(fig)

    # Built-in impurity-based forest feature importance.
    importance = pd.DataFrame(
        {"feature": feature_columns, "importance": forest.feature_importances_}
    ).sort_values("importance", ascending=False)
    importance.to_csv(destination / "feature_importance.csv", index=False)
    top = importance.head(min(20, len(importance))).sort_values("importance")
    fig, ax = plt.subplots(figsize=(9, max(4, 0.32 * len(top))))
    ax.barh(top["feature"], top["importance"], color="#4C9F70")
    ax.set_xlabel("Mean decrease in impurity")
    ax.set_title("Random forest feature importance")
    fig.tight_layout()
    fig.savefig(destination / "feature_importance.png", dpi=160)
    plt.close(fig)

    # ROC and AUC graph.
    fig, ax = plt.subplots(figsize=(5, 5))
    ax.plot(fpr, tpr, label=f"Random forest (AUC = {roc_auc:.3f})", color="#D1495B")
    ax.plot([0, 1], [0, 1], linestyle="--", color="gray", label="Chance")
    ax.set(xlabel="False positive rate", ylabel="True positive rate", title="ROC curve")
    ax.legend(loc="lower right")
    fig.tight_layout()
    fig.savefig(destination / "roc_auc.png", dpi=160)
    plt.close(fig)

    # Confusion matrix.
    matrix = confusion_matrix(y_test, predicted, labels=[0, 1])
    fig, ax = plt.subplots(figsize=(5, 5))
    ConfusionMatrixDisplay(matrix, display_labels=["Non-hotspot", "Hotspot"]).plot(
        ax=ax, cmap="Blues", colorbar=False
    )
    ax.set_title("Random forest confusion matrix")
    fig.tight_layout()
    fig.savefig(destination / "confusion_matrix.png", dpi=160)
    plt.close(fig)

    report = classification_report(
        y_test, predicted, labels=[0, 1], target_names=["non_hotspot", "hotspot"]
    )
    (destination / "classification_report.txt").write_text(
        f"Accuracy: {accuracy:.6f}\nROC AUC: {roc_auc:.6f}\n\n{report}", encoding="utf-8"
    )
    print(f"Held-out accuracy: {accuracy:.3f}")
    print(f"ROC AUC: {roc_auc:.3f}")
    print(f"Saved model, plots, report, and predictions to {destination}")
    return {
        "model": model,
        "accuracy": accuracy,
        "roc_auc": roc_auc,
        "feature_columns": feature_columns,
        "output_dir": destination,
    }


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", default="raster_point_features.csv", help="Input .csv or .parquet feature table")
    parser.add_argument("--output-dir", default="random_forest_results", help="Folder for model, plots, and predictions")
    parser.add_argument("--test-size", type=float, default=0.2, help="Fraction of rows held out for evaluation")
    parser.add_argument("--random-state", type=int, default=42)
    parser.add_argument("--n-estimators", type=int, default=300, help="Number of trees")
    args = parser.parse_args()
    train_random_forest(args.input, args.output_dir, args.test_size, args.random_state, args.n_estimators)


if __name__ == "__main__":
    main()
