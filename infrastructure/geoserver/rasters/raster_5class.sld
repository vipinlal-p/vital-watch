<?xml version="1.0" encoding="UTF-8"?>
<StyledLayerDescriptor version="1.0.0"
  xsi:schemaLocation="http://www.opengis.net/sld StyledLayerDescriptor.xsd"
  xmlns="http://www.opengis.net/sld"
  xmlns:ogc="http://www.opengis.net/ogc"
  xmlns:xlink="http://www.w3.org/1999/xlink"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <NamedLayer>
    <Name>raster_5class</Name>
    <UserStyle>
      <Title>Raster Five Class</Title>
      <FeatureTypeStyle>
        <Rule>
          <RasterSymbolizer>
            <Opacity>1.0</Opacity>
            <ColorMap type="intervals">
              <ColorMapEntry color="#15803d" quantity="20" label="Very Low" opacity="1.0" />
              <ColorMapEntry color="#65a30d" quantity="40" label="Low" opacity="1.0" />
              <ColorMapEntry color="#facc15" quantity="60" label="Moderate" opacity="1.0" />
              <ColorMapEntry color="#f97316" quantity="80" label="High" opacity="1.0" />
              <ColorMapEntry color="#dc2626" quantity="1000000000" label="Very High" opacity="1.0" />
            </ColorMap>
          </RasterSymbolizer>
        </Rule>
      </FeatureTypeStyle>
    </UserStyle>
  </NamedLayer>
</StyledLayerDescriptor>
