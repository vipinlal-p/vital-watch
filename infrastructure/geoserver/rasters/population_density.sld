<?xml version="1.0" encoding="UTF-8"?>
<StyledLayerDescriptor xmlns="http://www.opengis.net/sld" xmlns:gml="http://www.opengis.net/gml" xmlns:ogc="http://www.opengis.net/ogc" version="1.0.0" xmlns:sld="http://www.opengis.net/sld">
  <UserLayer>
    <sld:LayerFeatureConstraints>
      <sld:FeatureTypeConstraint/>
    </sld:LayerFeatureConstraints>
    <sld:UserStyle>
      <sld:Name>TVM_Population_30m_2020</sld:Name>
      <sld:FeatureTypeStyle>
        <sld:Rule>
          <sld:RasterSymbolizer>
            <sld:ChannelSelection>
              <sld:GrayChannel>
                <sld:SourceChannelName>1</sld:SourceChannelName>
              </sld:GrayChannel>
            </sld:ChannelSelection>
            <sld:ColorMap type="ramp">
              <sld:ColorMapEntry quantity="0.2234005" label="0.2234" color="#03051a"/>
              <sld:ColorMapEntry quantity="20.973552013000003" label="20.9736" color="#32183b"/>
              <sld:ColorMapEntry quantity="41.723703526000001" label="41.7237" color="#651f54"/>
              <sld:ColorMapEntry quantity="62.473855039" label="62.4739" color="#9e1a5b"/>
              <sld:ColorMapEntry quantity="83.224006552000006" label="83.2240" color="#d2204c"/>
              <sld:ColorMapEntry quantity="103.97415806500001" label="103.9742" color="#ef5940"/>
              <sld:ColorMapEntry quantity="124.724309578" label="124.7243" color="#f5956c"/>
              <sld:ColorMapEntry quantity="143.87829559000002" label="143.8783" color="#f7c6a7"/>
              <sld:ColorMapEntry quantity="159.83995060000001" label="159.8400" color="#faebdd"/>
            </sld:ColorMap>
          </sld:RasterSymbolizer>
        </sld:Rule>
      </sld:FeatureTypeStyle>
    </sld:UserStyle>
  </UserLayer>
</StyledLayerDescriptor>
