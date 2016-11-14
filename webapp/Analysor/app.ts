import Map = require("esri/map");

import GraphicsLayer = require("esri/layers/GraphicsLayer");
import Graphic = require("esri/graphic");

import jsonUtils = require("esri/symbols/jsonUtils");

import SimpleRenderer = require("esri/renderers/SimpleRenderer");

import Point = require("esri/geometry/Point");

import FeatureLayer = require("esri/layers/FeatureLayer");

import Extent = require("esri/geometry/Extent");

import InfoTemplate = require("esri/InfoTemplate");

import GeometryEngine = require("esri/geometry/geometryEngine");

import mixin = require("dojo/_base/lang");

import Measure = require("esri/dijit/Measurement");

import Polyline = require("esri/geometry/Polyline");
import Polygon = require("esri/geometry/Polygon");

import UniqueValueRenderer = require("esri/renderers/UniqueValueRenderer");

export = App;

interface MeasureDataItem {
    x: number;
    y: number;
    delay: number,
    signals: Array<{ minor: number, distance: number }>
}


class App {

    private map: Map;

    private measurePointLayer: GraphicsLayer;
    private resultLayer: GraphicsLayer;
    private polygonLayer: GraphicsLayer;

    private beaconLayer: FeatureLayer;

    constructor() {
        this.map = new Map("map", {
            basemap: "streets-vector",
            minScale: 20,
            extent: new Extent({ "xmin": 948536.7929136878, "ymin": 6005378.255159049, "xmax": 948932.7128335126, "ymax": 6005659.22095434, "spatialReference": { "wkid": 102100 } })
        });


        document.getElementById("fileselector").onchange = () => {


            var files = (<any>document.getElementById("fileselector")).files;

            var reader = new FileReader();

            reader.onload = (event: any) => {

                var dataUrl = event.target.result;

                this.proceed(JSON.parse(dataUrl));

            }

            reader.readAsText(files[0]);

        };

        new Measure({
            defaultLengthUnit: "meters",
            map: this.map
        }, "measure").startup();



        this.beaconLayer = new FeatureLayer("http://services7.arcgis.com/9lVYHAWgmOjTa6bn/arcgis/rest/services/Beacons_Office/FeatureServer/0",
            { mode: FeatureLayer.MODE_SNAPSHOT, outFields: ["*"] });

        this.map.addLayer(this.beaconLayer);

        this.measurePointLayer = new GraphicsLayer({
            infoTemplate: new InfoTemplate("Messpunkt", feature => {

                var template = "";
                for (let attr in feature.attributes) {
                    template += "<b>" + attr + "</b>: " + feature.attributes[attr] + "<br/>";
                }
                return template;
            })
        });
        this.measurePointLayer.setRenderer(new SimpleRenderer(jsonUtils.fromJson({
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
        })));

        this.map.addLayer(this.measurePointLayer);


        this.map.on("click", e => {
            if (e.graphic && this.measurePointLayer.graphics.indexOf(e.graphic) >= 0) {
                for (let g of this.resultLayer.graphics) {
                    g.visible = (g.attributes.measureId === (<any>e).graphic.attributes.measureId);
                }
                for (let g of this.polygonLayer.graphics) {
                    g.visible = (g.attributes.measureId === e.graphic.attributes.measureId);
                }

            } else if (e.graphic && (this.resultLayer.graphics.indexOf(e.graphic) >= 0 || this.polygonLayer.graphics.indexOf(e.graphic) >= 0)) { } else {
                for (let g of this.resultLayer.graphics) {
                    g.visible = true;
                }
                for (let g of this.polygonLayer.graphics) {
                    g.visible = true;
                }
            }

            this.polygonLayer.redraw();
            this.resultLayer.redraw();
        });

        var gOptions = {
            infoTemplate: new InfoTemplate("Berechnete Position", feature => {
                var template = "";
                for (let attr in feature.attributes) {
                    template += "<b>" + attr + "</b>: " + feature.attributes[attr] + "<br/>";
                }
                return template;
            })
        };

        this.polygonLayer = new GraphicsLayer(gOptions);
        this.polygonLayer.setRenderer(new SimpleRenderer(jsonUtils.fromJson({
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
        })));

        this.map.addLayer(this.polygonLayer);


        this.resultLayer = new GraphicsLayer(gOptions);

        var symbolJson = {
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
        };
        var renderer = new UniqueValueRenderer(jsonUtils.fromJson(symbolJson), "type", "isMinimalDistance", null, ",");
        symbolJson.color = [0, 0, 255, 255];
        renderer.addValue("weightedAvg,false", jsonUtils.fromJson(symbolJson));

        symbolJson.color = [0, 255, 0, 255];
        renderer.addValue("trilateration,false", jsonUtils.fromJson(symbolJson));

        symbolJson.outline.width = 2;
        renderer.addValue("trilateration,true", jsonUtils.fromJson(symbolJson));

        symbolJson.color = [0, 0, 255, 255];
        renderer.addValue("weightedAvg,true", jsonUtils.fromJson(symbolJson));


        renderer.setOpacityInfo({
            field: "distanceRatio",
            maxDataValue: 1,
            minDataValue: 0,
            opacityValues: [1, 0]
        });

        this.resultLayer.setRenderer(renderer);

        this.map.addLayer(this.resultLayer);



    }

    proceed(measureData: Array<MeasureDataItem>) {

        this.measurePointLayer.clear();
        this.resultLayer.clear();

        var measureId: { [id: string]: Graphic } = {};
        var connectedFeatures: { [id: string]: Array<Graphic> } = {};

        for (let item of measureData) {

            var id = item.x.toString() + "_" + item.y.toString();

            if (measureId[id] == null) {
                measureId[id] = new Graphic(new Point(item.x, item.y, this.map.spatialReference), null, { measureId: id });
                this.measurePointLayer.add(measureId[id]);


                connectedFeatures[id] = new Array<Graphic>();
            }

            var connected = this.getConnectedFeatures(item);

            for (let connectedFeature of connected) {
                connectedFeature.attributes.measureId = id;
                connectedFeature.attributes.isMinimalDistance = false;
                if (connectedFeature.geometry instanceof Point) {
                    this.resultLayer.add(connectedFeature);
                } else {
                    this.polygonLayer.add(connectedFeature);
                }

                connectedFeatures[id].push(connectedFeature);
            }
        }

        for (let id in connectedFeatures) {
            var measurePoint = measureId[id];

            for (let f of connectedFeatures[id]) {

                var poly1 = new Polyline(this.map.spatialReference);
                poly1.addPath([<any>measurePoint.geometry, <any>f.geometry]);

                f.attributes.distanceToOrigin = GeometryEngine.geodesicLength(poly1, "meters");
            }

            var stats = this.getStats(measurePoint, connectedFeatures[id], "weightedAvg");

            mixin.mixin(stats, this.getStats(measurePoint, connectedFeatures[id], "nearestPoint"));
            mixin.mixin(stats, this.getStats(measurePoint, connectedFeatures[id], "trilateration"));

            mixin.mixin(measurePoint.attributes, stats);
        }
    }

    getConnectedFeatures(measureItem: MeasureDataItem): Array<Graphic> {

        if (measureItem.signals && measureItem.signals.length > 0) {
            var weightedAvg = this.getWeightedAvg(measureItem);
            return [weightedAvg, this.getNearestPoint(measureItem), this.getTrilateration(measureItem)];
        }

        return [];

    }

    getWeightedAvg(measureItem: MeasureDataItem): Graphic {
        var latCounter = this.sum(measureItem.signals, item => this.getBeaconLat(item.minor) / item.distance);
        var lnCounter = this.sum(measureItem.signals, item => this.getBeaconLn(item.minor) / item.distance);
        var dividor = this.sum(measureItem.signals, item => 1 / item.distance);

        var lat = latCounter / dividor;
        var ln = lnCounter / dividor;

        return new Graphic(new Point(lat, ln, this.map.spatialReference), null, { type: "weightedAvg", delay: measureItem.delay });
    }

    getNearestPoint(measureItem: MeasureDataItem): Graphic {
        var min = this.min(measureItem.signals, t => t.distance);

        var beaconId = measureItem.signals.filter(s => s.distance === min)[0].minor;
        return new Graphic(this.getBeacon(beaconId).geometry, null, {
            type: "nearestPoint", delay: measureItem.delay
        });
    }

    getTrilateration(measureItem: MeasureDataItem): Graphic {
        var sorted = measureItem.signals.sort((a, b) => b.distance - a.distance);

        var farestBeacon = this.getBeacon(sorted[0].minor);
        var startingGeometry = GeometryEngine.geodesicBuffer(farestBeacon.geometry, sorted[0].distance, "meters");

        for (var j = 1; j < sorted.length; j++) {
            var buffer = GeometryEngine.geodesicBuffer(this.getBeacon(sorted[j].minor).geometry, sorted[j].distance, "meters");

            if (GeometryEngine.intersects(<any>buffer, <any>startingGeometry)) {
                startingGeometry = <any>GeometryEngine.intersect(buffer, <any>startingGeometry);
            } else {
                startingGeometry = buffer;
            }
        }

        startingGeometry = <any>GeometryEngine.simplify(<any>startingGeometry);

        //this.polygonLayer.add(new Graphic(<Polygon>startingGeometry, null, {
        //    type: "trilateration", delay: measureItem.delay
        //}));

        return new Graphic(this.getCentroid(<Polygon>startingGeometry), null, {
            type: "trilateration", delay: measureItem.delay
        });

    }

    getBeaconLat(beaconId: number): number {
        var beacon = this.getBeacon(beaconId);

        return (<Point>beacon.geometry).x
    }

    getBeaconLn(beaconId: number): number {
        return (<Point>this.getBeacon(beaconId).geometry).y;
    }

    getBeacon(beaconId: number): Graphic {
        return this.beaconLayer.graphics.filter(s => s.attributes.Minor === beaconId)[0];
    }

    getCentroid(geom: Polygon) {
        var pts = geom.rings[0].map(t => { return { x: t[0], y: t[1] }; });
        var nPts = pts.length;
        var off = pts[0];
        var twicearea = 0;
        var x = 0;
        var y = 0;
        var f;
        for (var i = 0, j = nPts - 1; i < nPts; j = i++) {
            let p1 = pts[i];
            let p2 = pts[j];
            f = (p1.x - off.x) * (p2.y - off.y) - (p2.x - off.x) * (p1.y - off.y);
            twicearea += f;
            x += (p1.x + p2.x - 2 * off.x) * f;
            y += (p1.y + p2.y - 2 * off.y) * f;
        }
        f = twicearea * 3;
        return new Point({
            x: x / f + off.x,
            y: y / f + off.y,
            spatialReference: this.map.spatialReference
        });
    }

    sum<T>(dat: Array<T>, selector: (T: T) => number): number {
        var s = 0;

        for (let k of dat) {
            s += selector(k);
        }

        return s;
    }

    avg<T>(dat: Array<T>, selector: (T: T) => number): number {
        var su = this.sum(dat, selector);
        return su / dat.length;
    }

    min<T>(dat: Array<T>, selector: (T: T) => number): number {
        var m = 1000000;

        for (let s of dat) {
            var v = selector(s);
            if (v < m) m = v;
        }

        return m;
    }

    max<T>(dat: Array<T>, selector: (T: T) => number): number {
        var m = 0;

        for (let s of dat) {
            var v = selector(s);
            if (v > m) m = v;
        }

        return m;
    }


    getStats(measurePoint: Graphic, positions: Array<Graphic>, type: string): any {
        var filtered = positions.filter(s => s.attributes.type === type);

        var stats = {}
        stats[type + "_avgDistance"] = this.avg(filtered, fet => fet.attributes.distanceToOrigin);
        stats[type + "_minDistance"] = this.min(filtered, fet => fet.attributes.distanceToOrigin);
        stats[type + "_maxDistance"] = this.max(filtered, fet => fet.attributes.distanceToOrigin);

        stats[type + "_abreviation"] = stats[type + "_maxDistance"] - stats[type + "_minDistance"];

        var featureWithMinDistance = filtered.filter(s => s.attributes.distanceToOrigin === stats[type + "_minDistance"])[0]

        stats[type + "_delayOfMinDistance"] = featureWithMinDistance.attributes.delay;
        featureWithMinDistance.attributes.isMinimalDistance = true;

        for (let f of filtered) {
            f.attributes.distanceRatio = (f.attributes.distanceToOrigin - stats[type + "_minDistance"]) / (stats[type + "_abreviation"]);
        }

        return stats;
    }
}