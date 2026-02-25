<?xml version="1.0" encoding="UTF-8"?>
<StyledLayerDescriptor xmlns="http://www.opengis.net/sld" version="1.0.0" xmlns:sld="http://www.opengis.net/sld" xmlns:gml="http://www.opengis.net/gml" xmlns:ogc="http://www.opengis.net/ogc">
  <UserLayer>
    <sld:LayerFeatureConstraints>
      <sld:FeatureTypeConstraint/>
    </sld:LayerFeatureConstraints>
    <sld:UserStyle>
      <sld:Name>TVM_30m_LULC_Latest</sld:Name>
      <sld:FeatureTypeStyle>
        <sld:Rule>
          <sld:RasterSymbolizer>
            <sld:ChannelSelection>
              <sld:GrayChannel>
                <sld:SourceChannelName>1</sld:SourceChannelName>
              </sld:GrayChannel>
            </sld:ChannelSelection>
            <sld:ColorMap type="values">
              <sld:ColorMapEntry label="1" color="#ed366a" quantity="1"/>
              <sld:ColorMapEntry label="2" color="#0d72ca" quantity="2"/>
              <sld:ColorMapEntry label="3" color="#e265e4" quantity="3"/>
              <sld:ColorMapEntry label="4" color="#b9e80e" quantity="4"/>
              <sld:ColorMapEntry label="5" color="#da7f30" quantity="5"/>
              <sld:ColorMapEntry label="6" color="#51e3ba" quantity="6"/>
              <sld:ColorMapEntry label="7" color="#7b61d8" quantity="7"/>
            </sld:ColorMap>
          </sld:RasterSymbolizer>
        </sld:Rule>
      </sld:FeatureTypeStyle>
    </sld:UserStyle>
  </UserLayer>
</StyledLayerDescriptor>
