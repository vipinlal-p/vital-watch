#!/bin/bash
set -e

# Use the service name 'geoserver' as the host, not localhost
GEOSERVER_URL="http://geoserver:8080/geoserver"
GEOSERVER_USER="admin"
GEOSERVER_PASS="geoserver"
WORKSPACE="raster"

# Path to rasters inside this container
HOST_RASTER_DIR="/infrastructure/geoserver/rasters"
# Directory where rasters are located inside the GeoServer container
CONTAINER_RASTER_DIR="/opt/geoserver/rasters"

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

# --- 1. Create GeoServer Workspace ---
echo "Checking for workspace '$WORKSPACE'..."
if resource_exists "$GEOSERVER_URL/rest/workspaces/$WORKSPACE.xml"; then
  echo "Workspace '$WORKSPACE' already exists."
else
  echo "Creating workspace '$WORKSPACE'..."
  curl -s -u "$GEOSERVER_USER:$GEOSERVER_PASS" -X POST -H "Content-type: text/xml" -d "<workspace><name>$WORKSPACE</name></workspace>" "$GEOSERVER_URL/rest/workspaces"
  echo -e "\nWorkspace created."
fi

# --- 2. Process each .tif file ---
for RASTER_FILE_PATH in $HOST_RASTER_DIR/*.tif; do
  if [ ! -f "$RASTER_FILE_PATH" ]; then
    echo "Warning: No .tif files found in $HOST_RASTER_DIR. Exiting."
    exit 0
  fi

  RASTER_FILENAME=$(basename "$RASTER_FILE_PATH")
  LAYER_NAME="${RASTER_FILENAME%.*}" # e.g., "dem.tif" -> "dem"
  SLD_FILE_PATH="$HOST_RASTER_DIR/$LAYER_NAME.sld"

  echo -e "\n--- Processing Raster: $RASTER_FILENAME ---"

  # --- 3. Create Coverage Store ---
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

  # --- 5. Upload and Apply Style ---
  if [ -f "$SLD_FILE_PATH" ]; then
    STYLE_NAME=$LAYER_NAME
    echo "Found style '$STYLE_NAME.sld'. Checking if it exists on GeoServer..."

    # Check if style exists
    if resource_exists "$GEOSERVER_URL/rest/styles/$STYLE_NAME.xml"; then
        echo "Style '$STYLE_NAME' already exists on GeoServer. Skipping upload."
    else
        echo "Uploading style '$STYLE_NAME.sld'..."
        curl -s -u "$GEOSERVER_USER:$GEOSERVER_PASS" -X POST -H "Content-type: application/vnd.ogc.sld+xml" --data-binary "@$SLD_FILE_PATH" "$GEOSERVER_URL/rest/workspaces/$WORKSPACE/styles?name=$STYLE_NAME"
        echo -e "\nStyle uploaded."
    fi

    # Apply style to layer
    echo "Applying style '$STYLE_NAME' to layer '$LAYER_NAME'..."
    LAYER_UPDATE_URL="$GEOSERVER_URL/rest/layers/$WORKSPACE:$LAYER_NAME"
    curl -s -u "$GEOSERVER_USER:$GEOSERVER_PASS" -X PUT -H "Content-type: text/xml" -d "<layer><defaultStyle><name>$WORKSPACE:$STYLE_NAME</name></defaultStyle><enabled>true</enabled></layer>" "$LAYER_UPDATE_URL"
    echo -e "\nStyle applied."

  else
    echo "No .sld file found for $RASTER_FILENAME."
  fi

done

echo -e "\n--- Script finished ---"