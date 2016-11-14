define({

    startExtent: { "xmin": 948536.7929136878, "ymin": 6005378.255159049, "xmax": 948932.7128335126, "ymax": 6005659.22095434, "spatialReference": { "wkid": 102100 } },
    beaconServiceUrl: "http://services7.arcgis.com/9lVYHAWgmOjTa6bn/arcgis/rest/services/Beacons_Office/FeatureServer/0",
    heatmapProperties: {
        colors: ["rgb(0, 255, 0)", "rgb(255, 255, 0)", "rgb(255, 0, 0)"],
        blurRadius: 12,
        maxPixelIntensity: 20,
        minPixelIntensity: 6
    },


    measurePointSymbol: {
        "color": [
            56,
            168,
            0,
            255
        ],
        "size": 4.5,
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
            "width": 0,
            "type": "esriSLS",
            "style": "esriSLSSolid"
        }
    },

    polygonSymbol: {
        "color": [
            0,
            0,
            0,
            64
        ],
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
        "size": 4.5,
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