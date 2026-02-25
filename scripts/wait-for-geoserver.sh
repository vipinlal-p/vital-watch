#!/bin/sh
set -e

# The script will wait for GeoServer to be available at this URL
GEOSERVER_URL="http://geoserver:8080/geoserver/rest/about/system-status"
PUBLISH_SCRIPT="/scripts/publish_rasters.sh"

echo "Initializing GeoServer... waiting for it to be ready."

# Loop until curl succeeds
until curl -s -f -u "admin:geoserver" "$GEOSERVER_URL" > /dev/null; do
  >&2 echo "GeoServer is unavailable - sleeping for 5 seconds..."
  sleep 5
done

>&2 echo "GeoServer is up. Running the publishing script."

# Execute the main publishing script
sh "$PUBLISH_SCRIPT"
