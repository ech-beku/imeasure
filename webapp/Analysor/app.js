define(["require", "exports", "esri/map", "esri/layers/GraphicsLayer", "esri/graphic", "esri/symbols/jsonUtils", "esri/renderers/SimpleRenderer", "esri/geometry/Point", "esri/layers/FeatureLayer", "esri/geometry/Extent", "esri/InfoTemplate", "esri/geometry/geometryEngine", "dojo/_base/lang", "esri/dijit/Measurement", "esri/geometry/Polyline", "esri/renderers/UniqueValueRenderer"], function (require, exports, Map, GraphicsLayer, Graphic, jsonUtils, SimpleRenderer, Point, FeatureLayer, Extent, InfoTemplate, GeometryEngine, mixin, Measure, Polyline, UniqueValueRenderer) {
    "use strict";
    var App = (function () {
        function App() {
            var _this = this;
            this.map = new Map("map", {
                basemap: "streets-vector",
                minScale: 20,
                extent: new Extent({ "xmin": 948536.7929136878, "ymin": 6005378.255159049, "xmax": 948932.7128335126, "ymax": 6005659.22095434, "spatialReference": { "wkid": 102100 } })
            });
            document.getElementById("fileselector").onchange = function () {
                var files = document.getElementById("fileselector").files;
                var reader = new FileReader();
                reader.onload = function (event) {
                    var dataUrl = event.target.result;
                    _this.proceed(JSON.parse(dataUrl));
                };
                reader.readAsText(files[0]);
            };
            new Measure({
                defaultLengthUnit: "meters",
                map: this.map
            }, "measure").startup();
            this.beaconLayer = new FeatureLayer("http://services7.arcgis.com/9lVYHAWgmOjTa6bn/arcgis/rest/services/Beacons_Office/FeatureServer/0", { mode: FeatureLayer.MODE_SNAPSHOT, outFields: ["*"] });
            this.map.addLayer(this.beaconLayer);
            this.measurePointLayer = new GraphicsLayer({
                infoTemplate: new InfoTemplate("Messpunkt", function (feature) {
                    var template = "";
                    for (var attr in feature.attributes) {
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
            this.map.on("click", function (e) {
                if (e.graphic && _this.measurePointLayer.graphics.indexOf(e.graphic) >= 0) {
                    for (var _i = 0, _a = _this.resultLayer.graphics; _i < _a.length; _i++) {
                        var g = _a[_i];
                        g.visible = (g.attributes.measureId === e.graphic.attributes.measureId);
                    }
                    for (var _b = 0, _c = _this.polygonLayer.graphics; _b < _c.length; _b++) {
                        var g = _c[_b];
                        g.visible = (g.attributes.measureId === e.graphic.attributes.measureId);
                    }
                }
                else if (e.graphic && (_this.resultLayer.graphics.indexOf(e.graphic) >= 0 || _this.polygonLayer.graphics.indexOf(e.graphic) >= 0)) { }
                else {
                    for (var _d = 0, _e = _this.resultLayer.graphics; _d < _e.length; _d++) {
                        var g = _e[_d];
                        g.visible = true;
                    }
                    for (var _f = 0, _g = _this.polygonLayer.graphics; _f < _g.length; _f++) {
                        var g = _g[_f];
                        g.visible = true;
                    }
                }
                _this.polygonLayer.redraw();
                _this.resultLayer.redraw();
            });
            var gOptions = {
                infoTemplate: new InfoTemplate("Berechnete Position", function (feature) {
                    var template = "";
                    for (var attr in feature.attributes) {
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
        App.prototype.proceed = function (measureData) {
            this.measurePointLayer.clear();
            this.resultLayer.clear();
            var measureId = {};
            var connectedFeatures = {};
            for (var _i = 0, measureData_1 = measureData; _i < measureData_1.length; _i++) {
                var item = measureData_1[_i];
                var id = item.x.toString() + "_" + item.y.toString();
                if (measureId[id] == null) {
                    measureId[id] = new Graphic(new Point(item.x, item.y, this.map.spatialReference), null, { measureId: id });
                    this.measurePointLayer.add(measureId[id]);
                    connectedFeatures[id] = new Array();
                }
                var connected = this.getConnectedFeatures(item);
                for (var _a = 0, connected_1 = connected; _a < connected_1.length; _a++) {
                    var connectedFeature = connected_1[_a];
                    connectedFeature.attributes.measureId = id;
                    connectedFeature.attributes.isMinimalDistance = false;
                    if (connectedFeature.geometry instanceof Point) {
                        this.resultLayer.add(connectedFeature);
                    }
                    else {
                        this.polygonLayer.add(connectedFeature);
                    }
                    connectedFeatures[id].push(connectedFeature);
                }
            }
            for (var id_1 in connectedFeatures) {
                var measurePoint = measureId[id_1];
                for (var _b = 0, _c = connectedFeatures[id_1]; _b < _c.length; _b++) {
                    var f = _c[_b];
                    var poly1 = new Polyline(this.map.spatialReference);
                    poly1.addPath([measurePoint.geometry, f.geometry]);
                    f.attributes.distanceToOrigin = GeometryEngine.geodesicLength(poly1, "meters");
                }
                var stats = this.getStats(measurePoint, connectedFeatures[id_1], "weightedAvg");
                mixin.mixin(stats, this.getStats(measurePoint, connectedFeatures[id_1], "nearestPoint"));
                mixin.mixin(stats, this.getStats(measurePoint, connectedFeatures[id_1], "trilateration"));
                mixin.mixin(measurePoint.attributes, stats);
            }
        };
        App.prototype.getConnectedFeatures = function (measureItem) {
            if (measureItem.signals && measureItem.signals.length > 0) {
                var weightedAvg = this.getWeightedAvg(measureItem);
                return [weightedAvg, this.getNearestPoint(measureItem), this.getTrilateration(measureItem)];
            }
            return [];
        };
        App.prototype.getWeightedAvg = function (measureItem) {
            var _this = this;
            var latCounter = this.sum(measureItem.signals, function (item) { return _this.getBeaconLat(item.minor) / item.distance; });
            var lnCounter = this.sum(measureItem.signals, function (item) { return _this.getBeaconLn(item.minor) / item.distance; });
            var dividor = this.sum(measureItem.signals, function (item) { return 1 / item.distance; });
            var lat = latCounter / dividor;
            var ln = lnCounter / dividor;
            return new Graphic(new Point(lat, ln, this.map.spatialReference), null, { type: "weightedAvg", delay: measureItem.delay });
        };
        App.prototype.getNearestPoint = function (measureItem) {
            var min = this.min(measureItem.signals, function (t) { return t.distance; });
            var beaconId = measureItem.signals.filter(function (s) { return s.distance === min; })[0].minor;
            return new Graphic(this.getBeacon(beaconId).geometry, null, {
                type: "nearestPoint", delay: measureItem.delay
            });
        };
        App.prototype.getTrilateration = function (measureItem) {
            var sorted = measureItem.signals.sort(function (a, b) { return b.distance - a.distance; });
            var farestBeacon = this.getBeacon(sorted[0].minor);
            var startingGeometry = GeometryEngine.geodesicBuffer(farestBeacon.geometry, sorted[0].distance, "meters");
            for (var j = 1; j < sorted.length; j++) {
                var buffer = GeometryEngine.geodesicBuffer(this.getBeacon(sorted[j].minor).geometry, sorted[j].distance, "meters");
                if (GeometryEngine.intersects(buffer, startingGeometry)) {
                    startingGeometry = GeometryEngine.intersect(buffer, startingGeometry);
                }
                else {
                    startingGeometry = buffer;
                }
            }
            startingGeometry = GeometryEngine.simplify(startingGeometry);
            //this.polygonLayer.add(new Graphic(<Polygon>startingGeometry, null, {
            //    type: "trilateration", delay: measureItem.delay
            //}));
            return new Graphic(this.getCentroid(startingGeometry), null, {
                type: "trilateration", delay: measureItem.delay
            });
        };
        App.prototype.getBeaconLat = function (beaconId) {
            var beacon = this.getBeacon(beaconId);
            return beacon.geometry.x;
        };
        App.prototype.getBeaconLn = function (beaconId) {
            return this.getBeacon(beaconId).geometry.y;
        };
        App.prototype.getBeacon = function (beaconId) {
            return this.beaconLayer.graphics.filter(function (s) { return s.attributes.Minor === beaconId; })[0];
        };
        App.prototype.getCentroid = function (geom) {
            var pts = geom.rings[0].map(function (t) { return { x: t[0], y: t[1] }; });
            var nPts = pts.length;
            var off = pts[0];
            var twicearea = 0;
            var x = 0;
            var y = 0;
            var f;
            for (var i = 0, j = nPts - 1; i < nPts; j = i++) {
                var p1 = pts[i];
                var p2 = pts[j];
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
        };
        App.prototype.sum = function (dat, selector) {
            var s = 0;
            for (var _i = 0, dat_1 = dat; _i < dat_1.length; _i++) {
                var k = dat_1[_i];
                s += selector(k);
            }
            return s;
        };
        App.prototype.avg = function (dat, selector) {
            var su = this.sum(dat, selector);
            return su / dat.length;
        };
        App.prototype.min = function (dat, selector) {
            var m = 1000000;
            for (var _i = 0, dat_2 = dat; _i < dat_2.length; _i++) {
                var s = dat_2[_i];
                var v = selector(s);
                if (v < m)
                    m = v;
            }
            return m;
        };
        App.prototype.max = function (dat, selector) {
            var m = 0;
            for (var _i = 0, dat_3 = dat; _i < dat_3.length; _i++) {
                var s = dat_3[_i];
                var v = selector(s);
                if (v > m)
                    m = v;
            }
            return m;
        };
        App.prototype.getStats = function (measurePoint, positions, type) {
            var filtered = positions.filter(function (s) { return s.attributes.type === type; });
            var stats = {};
            stats[type + "_avgDistance"] = this.avg(filtered, function (fet) { return fet.attributes.distanceToOrigin; });
            stats[type + "_minDistance"] = this.min(filtered, function (fet) { return fet.attributes.distanceToOrigin; });
            stats[type + "_maxDistance"] = this.max(filtered, function (fet) { return fet.attributes.distanceToOrigin; });
            stats[type + "_abreviation"] = stats[type + "_maxDistance"] - stats[type + "_minDistance"];
            var featureWithMinDistance = filtered.filter(function (s) { return s.attributes.distanceToOrigin === stats[type + "_minDistance"]; })[0];
            stats[type + "_delayOfMinDistance"] = featureWithMinDistance.attributes.delay;
            featureWithMinDistance.attributes.isMinimalDistance = true;
            for (var _i = 0, filtered_1 = filtered; _i < filtered_1.length; _i++) {
                var f = filtered_1[_i];
                f.attributes.distanceRatio = (f.attributes.distanceToOrigin - stats[type + "_minDistance"]) / (stats[type + "_abreviation"]);
            }
            return stats;
        };
        return App;
    }());
    return App;
});
//# sourceMappingURL=app.js.map