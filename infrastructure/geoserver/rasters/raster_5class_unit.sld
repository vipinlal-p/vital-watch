<?xml version="1.0" encoding="UTF-8"?>
<StyledLayerDescriptor version="1.0.0"
  xsi:schemaLocation="http://www.opengis.net/sld StyledLayerDescriptor.xsd"
  xmlns="http://www.opengis.net/sld"
  xmlns:ogc="http://www.opengis.net/ogc"
  xmlns:xlink="http://www.w3.org/1999/xlink"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <NamedLayer>
    <Name>raster_5class_unit</Name>
    <UserStyle>
      <Title>Raster Five Class (Unit Range)</Title>
      <FeatureTypeStyle>
        <Rule>
          <RasterSymbolizer>
            <Opacity>1.0</Opacity>
            <ColorMap type="intervals">
              <ColorMapEntry color="#15803d" quantity="0.2" label="Very Low (0-20%)" opacity="1.0" />
              <ColorMapEntry color="#65a30d" quantity="0.4" label="Low (20-40%)" opacity="1.0" />
              <ColorMapEntry color="#facc15" quantity="0.6" label="Moderate (40-60%)" opacity="1.0" />
              <ColorMapEntry color="#f97316" quantity="0.8" label="High (60-80%)" opacity="1.0" />
              <ColorMapEntry color="#dc2626" quantity="1.0" label="Very High (80-100%)" opacity="1.0" />
            </ColorMap>
          </RasterSymbolizer>
        </Rule>
      </FeatureTypeStyle>
    </UserStyle>
  </NamedLayer>
</StyledLayerDescriptor>
