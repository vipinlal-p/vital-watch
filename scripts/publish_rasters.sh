#!/bin/bash
set -e

# Use the service name 'geoserver' as the host, not localhost
GEOSERVER_URL="http://geoserver:8080/geoserver"
GEOSERVER_USER="admin"
GEOSERVER_PASS="geoserver"
WORKSPACE="raster"
COMMON_STYLE_NAME="raster_5class"
UNIT_STYLE_NAME="raster_5class_unit"

# Path to rasters inside this container
HOST_RASTER_DIR="/infrastructure/geoserver/rasters"
# Directory where rasters are located inside the GeoServer container
CONTAINER_RASTER_DIR="/opt/geoserver/rasters"
COMMON_STYLE_PATH="$HOST_RASTER_DIR/${COMMON_STYLE_NAME}.sld"
UNIT_STYLE_PATH="$HOST_RASTER_DIR/${UNIT_STYLE_NAME}.sld"

# --- Function to check if a GeoServer resource exists (200 OK) ---
resource_exists() {
  url=$1
  http_status=$(curl -s -o /dev/null -w "%{http_code}" -u "$GEOSERVER_USER:$GEOSERVER_PASS" "$url")
  if [ "$http_status" == "200" ]; then
    return 0 # Exists
  else
    return 1 # Does not exist
  fi
}

upsert_style() {
  style_name=$1
  style_path=$2

  if [ ! -f "$style_path" ]; then
    echo "Warning: Missing style file: $style_path"
    return 1
  fi

  echo "Checking for style '$style_name'..."
  if resource_exists "$GEOSERVER_URL/rest/workspaces/$WORKSPACE/styles/$style_name.xml"; then
    echo "Style '$style_name' exists. Updating style content..."
    curl -s -u "$GEOSERVER_USER:$GEOSERVER_PASS" -X PUT \
      -H "Content-type: application/vnd.ogc.sld+xml" \
      --data-binary "@$style_path" \
      "$GEOSERVER_URL/rest/workspaces/$WORKSPACE/styles/$style_name"
    echo -e "\nStyle '$style_name' updated."
  else
    echo "Uploading style '$style_name'..."
    curl -s -u "$GEOSERVER_USER:$GEOSERVER_PASS" -X POST \
      -H "Content-type: application/vnd.ogc.sld+xml" \
      --data-binary "@$style_path" \
      "$GEOSERVER_URL/rest/workspaces/$WORKSPACE/styles?name=$style_name"
    echo -e "\nStyle '$style_name' uploaded."
  fi
}

# --- 1. Create GeoServer Workspace ---
echo "Checking for workspace '$WORKSPACE'..."
if resource_exists "$GEOSERVER_URL/rest/workspaces/$WORKSPACE.xml"; then
  echo "Workspace '$WORKSPACE' already exists."
else
  echo "Creating workspace '$WORKSPACE'..."
  curl -s -u "$GEOSERVER_USER:$GEOSERVER_PASS" -X POST -H "Content-type: text/xml" -d "<workspace><name>$WORKSPACE</name></workspace>" "$GEOSERVER_URL/rest/workspaces"
  echo -e "\nWorkspace created."
fi

# --- 2. Create/Upload styles ---
upsert_style "$COMMON_STYLE_NAME" "$COMMON_STYLE_PATH" || true
upsert_style "$UNIT_STYLE_NAME" "$UNIT_STYLE_PATH" || true

# --- 3. Process each .tif file ---
for RASTER_FILE_PATH in $HOST_RASTER_DIR/*.tif; do
  if [ ! -f "$RASTER_FILE_PATH" ]; then
    echo "Warning: No .tif files found in $HOST_RASTER_DIR. Exiting."
    exit 0
  fi

  RASTER_FILENAME=$(basename "$RASTER_FILE_PATH")
  LAYER_NAME="${RASTER_FILENAME%.*}" # e.g., "dem.tif" -> "dem"

  echo -e "\n--- Processing Raster: $RASTER_FILENAME ---"

  # --- 4. Create Coverage Store ---
  STORE_URL="$GEOSERVER_URL/rest/workspaces/$WORKSPACE/coveragestores"
  echo "Checking for coverage store '$LAYER_NAME'..."
  if resource_exists "$STORE_URL/$LAYER_NAME.xml"; then
    echo "Coverage store '$LAYER_NAME' already exists. Skipping creation."
  else
    echo "Creating coverage store '$LAYER_NAME'..."
    curl -s -u "$GEOSERVER_USER:$GEOSERVER_PASS" -X POST -H "Content-type: application/xml" -d "<coverageStore><name>$LAYER_NAME</name><workspace>$WORKSPACE</workspace><enabled>true</enabled><type>GeoTIFF</type><url>file:$CONTAINER_RASTER_DIR/$RASTER_FILENAME</url></coverageStore>" "$STORE_URL"
    echo -e "\nCoverage store created."

    echo "Publishing layer '$LAYER_NAME'..."
    curl -s -u "$GEOSERVER_USER:$GEOSERVER_PASS" -X POST -H "Content-type: text/xml" -d "<coverage><name>$LAYER_NAME</name><nativeName>$LAYER_NAME</nativeName></coverage>" "$STORE_URL/$LAYER_NAME/coverages"
    echo "Layer '$LAYER_NAME' published."
  fi

  # --- 5. Apply style to each raster layer ---
  STYLE_TO_APPLY="$COMMON_STYLE_NAME"
  if [ "$LAYER_NAME" = "disease_risk_map" ]; then
    STYLE_TO_APPLY="$UNIT_STYLE_NAME"
  fi

  if resource_exists "$GEOSERVER_URL/rest/workspaces/$WORKSPACE/styles/$STYLE_TO_APPLY.xml"; then
    echo "Applying style '$STYLE_TO_APPLY' to layer '$LAYER_NAME'..."
    LAYER_UPDATE_URL="$GEOSERVER_URL/rest/layers/$WORKSPACE:$LAYER_NAME"
    curl -s -u "$GEOSERVER_USER:$GEOSERVER_PASS" -X PUT -H "Content-type: text/xml" -d "<layer><defaultStyle><name>$WORKSPACE:$STYLE_TO_APPLY</name></defaultStyle><enabled>true</enabled></layer>" "$LAYER_UPDATE_URL"
    echo -e "\nStyle applied."
  else
    echo "Skipping style assignment for '$LAYER_NAME' because style '$STYLE_TO_APPLY' is not available."
  fi

done

echo -e "\n--- Script finished ---"
