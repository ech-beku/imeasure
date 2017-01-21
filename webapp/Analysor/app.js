define(["require", "exports", "esri/map", "esri/layers/GraphicsLayer", "esri/graphic", "esri/symbols/jsonUtils", "esri/renderers/SimpleRenderer", "esri/geometry/Point", "esri/layers/FeatureLayer", "esri/geometry/Extent", "esri/InfoTemplate", "esri/geometry/geometryEngine", "dojo/_base/lang", "esri/dijit/Measurement", "esri/geometry/Polyline", "esri/renderers/UniqueValueRenderer", "esri/renderers/HeatmapRenderer"], function (require, exports, Map, GraphicsLayer, Graphic, jsonUtils, SimpleRenderer, Point, FeatureLayer, Extent, InfoTemplate, GeometryEngine, mixin, Measure, Polyline, UniqueValueRenderer, HeatmapRenderer) {
    "use strict";
    var App = (function () {
        function App(config) {
            this.config = config;
            this.distanceCorrection = 2;
            this.distanceFilter = 5;
            this.map = new Map("map", {
                basemap: "strseets-vector",
                extent: new Extent(this.config.startExtent)
            });
            new Measure({
                defaultLengthUnit: "meters",
                map: this.map
            }, "measure").startup();
            this.initializeUIEvents();
            this.initializeLayers();
        }
        App.prototype.initializeUIEvents = function () {
            var _this = this;
            document.getElementById("fileselector").onchange = function () {
                _this.readFile(document.getElementById("fileselector"), function (dataUrl) {
                    var t = new Date().getTime();
                    _this.jsonData = JSON.parse(dataUrl);
                    _this.cleanUnusedSignals();
                    if (_this.fingerPrintReference) {
                        _this.calculatePositions();
                    }
                    else {
                        alert("do not forgetti to set fingerprint reference!");
                    }
                    console.log("Processing took " + (new Date().getTime() - t).toString() + " ms");
                });
            };
            document.getElementById("fingerprintReference").onchange = function () {
                _this.readFile(document.getElementById("fingerprintReference"), function (dataUrl) {
                    _this.fingerPrintReference = JSON.parse(dataUrl);
                    console.log("loaded fingerprint reference...");
                });
            };
            this.txPower = document.getElementById("rssiSelector").value;
            document.getElementById("rssiSelector").onchange = function () {
                _this.txPower = document.getElementById("rssiSelector").value;
                document.getElementById("txPower").textContent = _this.txPower.toString();
                if (_this.jsonData) {
                    for (var _i = 0, _a = _this.jsonData; _i < _a.length; _i++) {
                        var k = _a[_i];
                        for (var _b = 0, _c = k.signals; _b < _c.length; _b++) {
                            var s = _c[_b];
                            s.distance = _this.calculateDistance(s.rssi, _this.txPower);
                        }
                    }
                }
            };
            document.getElementById("recalc").onclick = function () {
                _this.calculatePositions();
            };
            document.getElementById("heatmapSelector").onchange = function () {
                var type = document.getElementById("heatmapAttrSelector").value;
                (_this.heatmapLayer.renderer.setField(document.getElementById("heatmapSelector").value + "_" + type));
                _this.heatmapLayer.redraw();
            };
            document.getElementById("heatmapAttrSelector").onchange = function () {
                var type = document.getElementById("heatmapAttrSelector").value;
                (_this.heatmapLayer.renderer.setField(document.getElementById("heatmapSelector").value + "_" + type));
                _this.heatmapLayer.redraw();
            };
            document.getElementById("heatmapMin").onchange = function () {
                _this.heatmapLayer.renderer.setMinPixelIntensity(document.getElementById("heatmapMin").value);
                _this.heatmapLayer.redraw();
            };
            document.getElementById("heatmapMax").onchange = function () {
                _this.heatmapLayer.renderer.setMaxPixelIntensity(document.getElementById("heatmapMax").value);
                _this.heatmapLayer.redraw();
            };
            document.getElementById("heatmapBlur").onchange = function () {
                _this.heatmapLayer.renderer.setBlurRadius(document.getElementById("heatmapBlur").value);
                _this.heatmapLayer.redraw();
            };
            document.getElementById("rssiCalibration").onclick = function () {
                _this.createRssiCalibrationReport();
            };
            document.getElementById("drawTrilateration").onclick = function () {
                _this.polygonLayer.setVisibility(document.getElementById("drawTrilateration").checked);
            };
            document.getElementById("drawResultPoints").onclick = function () {
                _this.resultLayer.setVisibility(document.getElementById("drawResultPoints").checked);
            };
            document.getElementById("umfeld").onchange = function () {
                _this.changeUmfeld(document.getElementById("umfeld").value);
            };
        };
        App.prototype.readFile = function (input, proceed) {
            var files = input.files;
            var reader = new FileReader();
            reader.onload = function (event) {
                var dataUrl = event.target.result;
                proceed(dataUrl);
            };
            reader.readAsText(files[0]);
        };
        App.prototype.changeUmfeld = function (ind) {
            if (this.beaconLayer)
                this.map.removeLayer(this.beaconLayer);
            if (this.grundrissLayer)
                this.map.removeLayer(this.grundrissLayer);
            this.beaconLayer = new FeatureLayer(this.config.serviceUrls[ind].beaconServiceUrl, { mode: FeatureLayer.MODE_SNAPSHOT, outFields: ["*"] });
            this.grundrissLayer = new FeatureLayer(this.config.serviceUrls[ind].umgebungServiceUrl, { mode: FeatureLayer.MODE_SNAPSHOT });
            this.map.addLayer(this.grundrissLayer);
            this.map.addLayer(this.beaconLayer);
        };
        App.prototype.initializeLayers = function () {
            var _this = this;
            this.changeUmfeld(0);
            var layerDefinition = {
                "geometryType": "esriGeometryPoint",
                "fields": [{
                        "name": "BUFF_DIST",
                        "type": "esriFieldTypeInteger",
                        "alias": "Buffer Distance"
                    }]
            };
            var featureCollection = {
                layerDefinition: layerDefinition,
                featureSet: null
            };
            this.heatmapLayer = new FeatureLayer(featureCollection, { infoTemplate: null });
            this.heatmapLayer.htmlPopupType = FeatureLayer.POPUP_NONE;
            this.heatmapLayer.setRenderer(new HeatmapRenderer(this.config.heatmapProperties));
            this.heatmapLayer.setOpacity(0.5);
            this.map.addLayer(this.heatmapLayer);
            var simpleFeatureInfotemplateFunc = function (feature) {
                var template = "";
                for (var attr in feature.attributes) {
                    template += "<b>" + attr + "</b>: " + feature.attributes[attr] + "<br/>";
                }
                return template;
            };
            this.measurePointLayer = new GraphicsLayer({
                infoTemplate: new InfoTemplate("Messpunkt", simpleFeatureInfotemplateFunc)
            });
            this.map.on("click", function (e) {
                _this.onMapClick(e);
            });
            var gOptions = {
                infoTemplate: new InfoTemplate("Berechnete Position", simpleFeatureInfotemplateFunc)
            };
            this.polygonLayer = new GraphicsLayer(gOptions);
            this.polygonLayer.setRenderer(new SimpleRenderer(jsonUtils.fromJson(this.config.polygonSymbol)));
            this.map.addLayer(this.polygonLayer);
            this.resultLayer = new GraphicsLayer(gOptions);
            var symbolJson = this.config.resultPositionSymbol;
            var renderer = new UniqueValueRenderer(jsonUtils.fromJson(symbolJson), "type", "isMinimalDistance", null, ",");
            symbolJson.color = [0, 0, 255, 255];
            renderer.addValue("weightedAvg,false", jsonUtils.fromJson(symbolJson));
            symbolJson.color = [255, 0, 255, 255];
            renderer.addValue("trilateration,false", jsonUtils.fromJson(symbolJson));
            symbolJson.color = [128, 128, 128, 255];
            renderer.addValue("fingerprint,false", jsonUtils.fromJson(symbolJson));
            symbolJson.outline.width = 5;
            symbolJson.outline.color = [255, 0, 255, 255];
            renderer.addValue("trilateration,true", jsonUtils.fromJson(symbolJson));
            symbolJson.color = [0, 0, 255, 255];
            symbolJson.outline.color = [0, 0, 255, 255];
            renderer.addValue("weightedAvg,true", jsonUtils.fromJson(symbolJson));
            symbolJson.color = [255, 0, 0, 255];
            symbolJson.outline.color = [255, 0, 0, 255];
            renderer.addValue("nearestPoint,true", jsonUtils.fromJson(symbolJson));
            symbolJson.color = [128, 128, 128, 255];
            symbolJson.outline.color = [128, 128, 128, 255];
            renderer.addValue("fingerprint,true", jsonUtils.fromJson(symbolJson));
            renderer.setOpacityInfo({
                field: "distanceRatio",
                maxDataValue: 1,
                minDataValue: 0,
                opacityValues: [1, 0.5]
            });
            this.resultLayer.setRenderer(renderer);
            this.measurePointLayer.setRenderer(new SimpleRenderer(jsonUtils.fromJson(this.config.measurePointSymbol)));
            this.map.addLayer(this.measurePointLayer);
            this.map.addLayer(this.resultLayer);
        };
        App.prototype.calculatePositions = function () {
            var measureData = this.jsonData;
            this.distanceCorrection = parseInt(document.getElementById("distanceCorrection").value);
            this.distanceFilter = parseFloat(document.getElementById("distanceFilter").value);
            if (document.getElementById("proceesOnly5").checked && this.jsonData.length > 100) {
                measureData = this.jsonData.slice(0, 100);
            }
            this.heatmapLayer.clear();
            this.measurePointLayer.clear();
            this.resultLayer.clear();
            this.polygonLayer.clear();
            var measureId = {};
            var connectedFeatures = {};
            for (var _i = 0, measureData_1 = measureData; _i < measureData_1.length; _i++) {
                var item = measureData_1[_i];
                var id = item.x.toString() + "_" + item.y.toString();
                console.log("processing " + id);
                if (measureId[id] == null) {
                    measureId[id] = new Graphic(new Point(item.x, item.y, this.map.spatialReference), null, { measureId: id });
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
            var latencyData = { "weightedAvg": "", "nearestPoint": "", trilateration: "", fingerprint: "" };
            var types = ["weightedAvg", "nearestPoint", "trilateration", "fingerprint"];
            console.log("processing statistics");
            for (var id_1 in connectedFeatures) {
                var measurePoint = measureId[id_1];
                console.log("processing " + id_1);
                for (var _b = 0, _c = connectedFeatures[id_1]; _b < _c.length; _b++) {
                    var f_1 = _c[_b];
                    f_1.attributes.distanceToOrigin = this.getDistanceFromPoints(measurePoint.geometry, f_1.geometry);
                }
                var _loop_1 = function (t) {
                    ps = connectedFeatures[id_1].filter(function (a) { return a.attributes.type === t; });
                    line = id_1 + "\t";
                    var _loop_2 = function (i) {
                        f = ps.filter(function (a) { return i * 1000 < a.attributes.delay && a.attributes.delay <= (i + 1) * 1000; });
                        line += this_1.avg(f.map(function (s) { return s.attributes.distanceToOrigin; }), function (k) { return k; }) + "\t";
                    };
                    for (var i = 0; i <= 30; i++) {
                        _loop_2(i);
                    }
                    latencyData[t] += line + "\n";
                };
                var this_1 = this, ps, line, f;
                for (var _d = 0, types_1 = types; _d < types_1.length; _d++) {
                    var t = types_1[_d];
                    _loop_1(t);
                }
                var stats = this.getStats(measurePoint, connectedFeatures[id_1], "weightedAvg");
                mixin.mixin(stats, this.getStats(measurePoint, connectedFeatures[id_1], "nearestPoint"));
                mixin.mixin(stats, this.getStats(measurePoint, connectedFeatures[id_1], "trilateration"));
                mixin.mixin(stats, this.getStats(measurePoint, connectedFeatures[id_1], "fingerprint"));
                mixin.mixin(measurePoint.attributes, stats);
                this.measurePointLayer.add(measurePoint);
                this.heatmapLayer.add(new Graphic(measurePoint.geometry, null, measurePoint.attributes));
            }
            this.collectOverallStats(latencyData);
            this.heatmapLayer.redraw();
            this.resultLayer.redraw();
        };
        App.prototype.cleanUnusedSignals = function () {
            var beaconMinors = this.beaconLayer.graphics.map(function (t) { return t.attributes.Minor; });
            for (var _i = 0, _a = this.jsonData; _i < _a.length; _i++) {
                var measurement = _a[_i];
                for (var i = measurement.signals.length - 1; i >= 0; i--) {
                    if (beaconMinors.indexOf(measurement.signals[i].minor) < 0) {
                        measurement.signals.splice(i, 1);
                    }
                }
            }
        };
        App.prototype.getDistanceFromPoints = function (p1, p2) {
            var poly1 = new Polyline(this.map.spatialReference);
            poly1.addPath([p1, p2]);
            return GeometryEngine.geodesicLength(poly1, "meters");
        };
        App.prototype.collectOverallStats = function (latencyData) {
            var types = ["weightedAvg", "nearestPoint", "trilateration", "fingerprint"];
            var attrs = ["_avgDistance", "_minDistance", "_maxDistance", "_delayOfMinDistance"];
            var currentRows = document.getElementsByClassName("statsrow");
            while (currentRows.length > 0) {
                currentRows.item(0).remove();
            }
            var _loop_3 = function (typ) {
                filtered = this_2.resultLayer.graphics.filter(function (t) { return t.attributes.type === typ; });
                html = "<td>" + typ + "</td>";
                var _loop_4 = function (att) {
                    html += "<td>" + this_2.avg(this_2.measurePointLayer.graphics, function (f) { return f.attributes[typ + att]; }).toFixed(2) + " m </td>";
                };
                for (var _i = 0, attrs_1 = attrs; _i < attrs_1.length; _i++) {
                    var att = attrs_1[_i];
                    _loop_4(att);
                }
                overallAvg = this_2.avg(filtered, function (f) { return f.attributes["distanceToOrigin"]; });
                sttdev = Math.sqrt(this_2.varianz(filtered, function (f) { return f.attributes["distanceToOrigin"]; }));
                normV = this_2.normVerteilung(filtered, function (f) { return f.attributes["distanceToOrigin"]; }, -10, 10, 0.5);
                raw = filtered.map(function (s) { return s.attributes["distanceToOrigin"]; }).join("\n");
                html += "<td>" + overallAvg + "</td><td>" + sttdev + "</td><td><textarea>" + this_2.normToString(normV) + "</textarea></td><td><textarea>" + raw + "</textarea><textarea>" + latencyData[typ] + "</textarea></td>";
                row = document.createElement("tr");
                row.innerHTML = html;
                row.className = "statsrow";
                document.getElementById("statsTable").appendChild(row);
            };
            var this_2 = this, filtered, html, overallAvg, sttdev, normV, raw, row;
            for (var _i = 0, types_2 = types; _i < types_2.length; _i++) {
                var typ = types_2[_i];
                _loop_3(typ);
            }
        };
        App.prototype.getConnectedFeatures = function (measureItem) {
            if (measureItem.signals && measureItem.signals.length > 0) {
                var weightedAvg = this.getWeightedAvg(measureItem);
                var nearest = this.getNearestPoint(measureItem);
                var trilat = this.getTrilateration(measureItem);
                var fingerPrt = this.getFingerPrint(measureItem);
                var res = [];
                if (weightedAvg)
                    res.push(weightedAvg);
                if (nearest)
                    res.push(nearest);
                if (trilat)
                    res.push(trilat);
                if (fingerPrt)
                    res.push(fingerPrt);
                return res;
            }
            return [];
        };
        App.prototype.getWeightedAvg = function (measureItem) {
            var _this = this;
            var filtered = measureItem.signals.filter(function (h) { return h.distance < _this.distanceFilter; });
            if (filtered.length > 0) {
                var latCounter = this.sum(filtered, function (item) { return _this.getBeaconLat(item.minor) / item.distance; });
                var lnCounter = this.sum(filtered, function (item) { return _this.getBeaconLn(item.minor) / item.distance; });
                var dividor = this.sum(filtered, function (item) { return 1 / item.distance; });
                var lat = latCounter / dividor;
                var ln = lnCounter / dividor;
                return new Graphic(new Point(lat, ln, this.map.spatialReference), null, { type: "weightedAvg", delay: measureItem.delay });
            }
        };
        App.prototype.getNearestPoint = function (measureItem) {
            var _this = this;
            var filtered = measureItem.signals.filter(function (h) { return h.distance < _this.distanceFilter; });
            var min = this.min(filtered, function (t) { return t.distance; });
            var beacon = filtered.filter(function (s) { return s.distance === min; });
            if (beacon.length > 0) {
                var beaconId = beacon[0].minor;
                return new Graphic(this.getBeacon(beaconId).geometry, null, {
                    type: "nearestPoint", delay: measureItem.delay
                });
            }
        };
        App.prototype.getTrilateration = function (measureItem) {
            var _this = this;
            var filtered = measureItem.signals.filter(function (h) { return h.distance < _this.distanceFilter; });
            var sorted = filtered.sort(function (a, b) { return b.distance - a.distance; });
            if (sorted.length > 0) {
                var farestBeacon = this.getBeacon(sorted[0].minor);
                var startingGeometry = GeometryEngine.geodesicBuffer(farestBeacon.geometry, sorted[0].distance, "meters");
                if (startingGeometry == null)
                    console.log("starting geometry was null");
                for (var j = 1; j < sorted.length; j++) {
                    var buffer = GeometryEngine.geodesicBuffer(this.getBeacon(sorted[j].minor).geometry, sorted[j].distance, "meters");
                    if (buffer == null) {
                        console.log("buffer geometry was null");
                    }
                    else {
                        this.polygonLayer.add(new Graphic(buffer, null, {
                            type: "trilateration", delay: measureItem.delay, measureId: measureItem.x.toString() + "_" + measureItem.y.toString()
                        }));
                    }
                    ;
                    try {
                        if (GeometryEngine.intersects(buffer, startingGeometry)) {
                            var intersection = GeometryEngine.intersect(buffer, startingGeometry);
                            if (intersection == null) {
                                console.log("buffer and start intersected, but intersection was null");
                            }
                            else {
                                startingGeometry = intersection;
                            }
                        }
                        else {
                            startingGeometry = buffer;
                        }
                    }
                    catch (e) {
                        console.log(buffer, startingGeometry);
                    }
                }
                startingGeometry = GeometryEngine.simplify(startingGeometry);
                this.polygonLayer.add(new Graphic(startingGeometry, null, {
                    type: "trilateration", delay: measureItem.delay, measureId: measureItem.x.toString() + "_" + measureItem.y.toString()
                }));
                return new Graphic(this.getCentroid(startingGeometry), null, {
                    type: "trilateration", delay: measureItem.delay
                });
            }
        };
        App.prototype.getFingerPrint = function (measureItem) {
            var minFpr = null;
            var minDistance = 1000000;
            for (var _i = 0, _a = this.fingerPrintReference; _i < _a.length; _i++) {
                var fpr = _a[_i];
                var distance = this.getFingerPrintDistance(measureItem, fpr);
                if (distance < minDistance) {
                    minFpr = fpr;
                    minDistance = distance;
                }
            }
            if (minFpr) {
                var g = new Graphic(new Point(minFpr.x, minFpr.y, this.map.spatialReference), null, { type: "fingerprint", delay: measureItem.delay });
                return g;
            }
            return null;
        };
        App.prototype.getFingerPrintDistance = function (measureItem1, measureItem2) {
            var dist = 0;
            var matches = 0;
            var _loop_5 = function (sig) {
                s = measureItem2.signals.filter(function (t) { return t.minor === sig.minor; });
                if (s.length > 0) {
                    dist += Math.abs(s[0].rssi - sig.rssi);
                    matches++;
                }
            };
            var s;
            for (var _i = 0, _a = measureItem1.signals; _i < _a.length; _i++) {
                var sig = _a[_i];
                _loop_5(sig);
            }
            if (matches >= 3) {
                return dist;
            }
            else {
                return 10000;
            }
        };
        App.prototype.getBeaconLat = function (beaconId) {
            var beacon = this.getBeacon(beaconId);
            if (beacon)
                return beacon.geometry.x;
        };
        App.prototype.getBeaconLn = function (beaconId) {
            var beacon = this.getBeacon(beaconId);
            if (beacon)
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
        App.prototype.varianz = function (dat, selector) {
            var avg2 = this.avg(dat, selector);
            return this.sum(dat, function (s) { return Math.pow(avg2 - selector(s), 2); }) / dat.length;
        };
        App.prototype.normVerteilung = function (dat, selector, start, stop, step) {
            var stat = {};
            for (var j = start; j <= stop; j += step) {
                stat[j] = 0;
                for (var _i = 0, dat_4 = dat; _i < dat_4.length; _i++) {
                    var item = dat_4[_i];
                    var val = selector(item);
                    if (j <= val && val < (j + step))
                        stat[j]++;
                }
            }
            return stat;
        };
        App.prototype.normToString = function (stat) {
            var str = "";
            for (var item in stat) {
                str += item + "\t" + stat[item] + "\n";
            }
            return str;
        };
        App.prototype.getStats = function (measurePoint, positions, type) {
            var filtered = positions.filter(function (s) { return s.attributes.type === type; });
            var stats = {};
            if (filtered.length > 0) {
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
            }
            return stats;
        };
        App.prototype.calculateDistance = function (rssi, txPower) {
            if (rssi == 0) {
                return -1.0; // if we cannot determine accuracy, return -1.
            }
            var ratio = rssi * 1.0 / txPower;
            if (ratio < 1.0) {
                return Math.pow(ratio, 10) + this.distanceCorrection;
            }
            else {
                var accuracy = (0.89976) * Math.pow(ratio, 7.7095) + 0.111;
                return accuracy + this.distanceCorrection;
            }
        };
        App.prototype.onMapClick = function (e) {
            if (e.graphic && this.measurePointLayer.graphics.indexOf(e.graphic) >= 0) {
                for (var _i = 0, _a = this.resultLayer.graphics; _i < _a.length; _i++) {
                    var g = _a[_i];
                    g.visible = (g.attributes.measureId === e.graphic.attributes.measureId);
                }
                for (var _b = 0, _c = this.polygonLayer.graphics; _b < _c.length; _b++) {
                    var g = _c[_b];
                    g.visible = (g.attributes.measureId === e.graphic.attributes.measureId);
                }
            }
            else if (e.graphic && (this.resultLayer.graphics.indexOf(e.graphic) >= 0 || this.polygonLayer.graphics.indexOf(e.graphic) >= 0)) { }
            else {
                for (var _d = 0, _e = this.resultLayer.graphics; _d < _e.length; _d++) {
                    var g = _e[_d];
                    g.visible = true;
                }
                for (var _f = 0, _g = this.polygonLayer.graphics; _f < _g.length; _f++) {
                    var g = _g[_f];
                    g.visible = true;
                }
            }
            this.polygonLayer.redraw();
            this.resultLayer.redraw();
        };
        App.prototype.createRssiCalibrationReport = function () {
            this.distanceCorrection = parseInt(document.getElementById("distanceCorrection").value);
            this.distanceFilter = parseFloat(document.getElementById("distanceFilter").value);
            var txPowers = [];
            var dists = {};
            for (var i = -58; i < -40; i++) {
                txPowers.push(i);
                dists[i] = [];
            }
            var measureIds = {};
            var allDeltas = {};
            for (var _i = 0, _a = this.jsonData; _i < _a.length; _i++) {
                var measurePoint_1 = _a[_i];
                var id = measurePoint_1.x.toString() + "_" + measurePoint_1.y.toString();
                if (measureIds[id] == null) {
                    measureIds[id] = { signals: [], x: measurePoint_1.x, y: measurePoint_1.y };
                }
                for (var _b = 0, _c = measurePoint_1.signals; _b < _c.length; _b++) {
                    var sig = _c[_b];
                    measureIds[id].signals.push(sig);
                }
            }
            for (var id_2 in measureIds) {
                var measurePoint = measureIds[id_2];
                var collectedBeacons = {};
                for (var _d = 0, _e = measurePoint.signals; _d < _e.length; _d++) {
                    var sig = _e[_d];
                    if (collectedBeacons[sig.minor] == null) {
                        collectedBeacons[sig.minor] = [sig.rssi];
                    }
                    else {
                        collectedBeacons[sig.minor].push(sig.rssi);
                    }
                }
                for (var beac in collectedBeacons) {
                    var bec = this.getBeacon(parseInt(beac));
                    var distanceBecMeasure = this.getDistanceFromPoints(new Point(measurePoint.x, measurePoint.y, this.map.spatialReference), bec.geometry);
                    for (var _f = 0, txPowers_1 = txPowers; _f < txPowers_1.length; _f++) {
                        var txPower = txPowers_1[_f];
                        if (allDeltas[txPower] == null)
                            allDeltas[txPower] = [];
                        var sss = [];
                        for (var _g = 0, _h = collectedBeacons[beac]; _g < _h.length; _g++) {
                            var k = _h[_g];
                            var dist = this.calculateDistance(k, txPower);
                            if (0 - this.distanceFilter < dist && dist < this.distanceFilter) {
                                allDeltas[txPower].push(dist - distanceBecMeasure);
                                sss.push(dist);
                            }
                        }
                        if (sss.length <= 0) {
                            console.log("no data for tx" + txPower);
                        }
                        else {
                            var distAvg = this.avg(sss, function (s) { return s; });
                            var deltaDist = distAvg - distanceBecMeasure;
                            dists[txPower].push(deltaDist);
                        }
                    }
                }
            }
            var tab = document.createElement("table");
            var _loop_6 = function (dist_1) {
                var cur = dists[dist_1];
                avg = this_3.avg(cur, function (s) { return s; });
                avg2 = this_3.avg(allDeltas[dist_1], function (s) { return s; });
                varianz = this_3.varianz(allDeltas[dist_1], function (s) { return s; });
                stddev = Math.sqrt(varianz);
                tr = document.createElement("tr");
                td1 = document.createElement("td");
                td1.textContent = dist_1;
                td2 = document.createElement("td");
                td2.textContent = avg.toFixed(2) + "/" + avg2.toFixed(2) + " / " + varianz.toFixed(2) + " / " + stddev.toFixed(2);
                tr.appendChild(td1);
                tr.appendChild(td2);
                tab.appendChild(tr);
                tr.style.cursor = "pointer";
                tr.onclick = function () {
                    var stat = allDeltas[dist_1].join("\n");
                    var i = document.createElement("textarea");
                    i.value = stat;
                    document.getElementById("calibrationresult").appendChild(i);
                };
            };
            var this_3 = this, avg, avg2, varianz, stddev, tr, td1, td2;
            for (var dist_1 in dists) {
                _loop_6(dist_1);
            }
            document.getElementById("calibrationresult").innerHTML = "";
            document.getElementById("calibrationresult").appendChild(tab);
        };
        return App;
    }());
    return App;
});
//# sourceMappingURL=app.js.map