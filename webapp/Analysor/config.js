define({

    startExtent: {
        "xmin": 0,
        "ymin": 0,
        "xmax": 7.1490000002086163,
        "ymax": 8.1000000014901161,
        "spatialReference": {
            "wkid": 102100,
            "latestWkid": 3857
        }
    },

    serviceUrls: [{
        beaconServiceUrl: "http://services7.arcgis.com/9lVYHAWgmOjTa6bn/arcgis/rest/services/Umgebung_1/FeatureServer/0",
        umgebungServiceUrl: "http://services7.arcgis.com/9lVYHAWgmOjTa6bn/ArcGIS/rest/services/Umgebung_1/FeatureServer/3"
    }, {
        beaconServiceUrl: "http://services7.arcgis.com/9lVYHAWgmOjTa6bn/arcgis/rest/services/Umgebung_2/FeatureServer/0",
        umgebungServiceUrl: "http://services7.arcgis.com/9lVYHAWgmOjTa6bn/ArcGIS/rest/services/Umgebung_2/FeatureServer/2"
    }],

    heatmapProperties: {
        colors: ["rgb(0, 255, 0)", "rgb(255, 255, 0)", "rgb(255, 0, 0)"],
        blurRadius: 30,
        maxPixelIntensity: 90,
        minPixelIntensity: 20
    },


    measurePointSymbol: {
        "color": [
            56,
            168,
            0,
            255
        ],
        "size": 7,
        "angle": 0,
        "xoffset": 0,
        "yoffset": 0,
        "type": "esriSMS",
        "style": "esriSMSCircle",
        "outline": {
            "color": [
                0,
                0,
                0,
                255
            ],
            "width": 1,
            "type": "esriSLS",
            "style": "esriSLSSolid"
        }
    },

    polygonSymbol: {
        "color": [
            0,
            0,
            0,
            0
        ],
        "outline": {
            "color": [
                0,
                0,
                0,
                255
            ],
            "width": 0.5,
            "type": "esriSLS",
            "style": "esriSLSSolid"
        },
        "type": "esriSFS",
        "style": "esriSFSSolid"
    },

    resultPositionSymbol: {
        "color": [
            255,
            0,
            0,
            255
        ],
        "size": 2,
        "angle": 0,
        "xoffset": 0,
        "yoffset": 0,
        "type": "esriSMS",
        "style": "esriSMSCircle",
        "outline": {
            "color": [
                255,
                0,
                0,
                255
            ],
            "width": 0,
            "type": "esriSLS",
            "style": "esriSLSSolid"
        }
    }
});