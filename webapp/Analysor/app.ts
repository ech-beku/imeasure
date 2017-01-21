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

import HeatmapRenderer = require("esri/renderers/HeatmapRenderer");

export = App;

interface MeasureDataItem {
    x: number;
    y: number;
    delay: number,
    signals: Array<{ minor: number, distance: number, rssi: number }>
}


class App {

    private map: Map;

    private measurePointLayer: GraphicsLayer;

    private heatmapLayer: FeatureLayer;

    private resultLayer: GraphicsLayer;
    private polygonLayer: GraphicsLayer;

    private beaconLayer: FeatureLayer;
    private grundrissLayer: FeatureLayer;

    private jsonData: Array<MeasureDataItem>;
    private fingerPrintReference: Array<MeasureDataItem>;

    private txPower: number;

    private distanceCorrection: number = 2;
    private distanceFilter: number = 5;

    constructor(private config) {

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

    private initializeUIEvents() {

        document.getElementById("fileselector").onchange = () => {

            this.readFile(document.getElementById("fileselector"), (dataUrl) => {

                var t = new Date().getTime();
                
                this.jsonData = JSON.parse(dataUrl);
                this.cleanUnusedSignals();

                if (this.fingerPrintReference) {
                    this.calculatePositions();
                } else {
                    alert("do not forgetti to set fingerprint reference!");
                }
                console.log("Processing took " + (new Date().getTime() - t).toString() + " ms");
            });
        };

        document.getElementById("fingerprintReference").onchange = () => {

            this.readFile(document.getElementById("fingerprintReference"), (dataUrl) => {
                this.fingerPrintReference = JSON.parse(dataUrl);
                console.log("loaded fingerprint reference...");
            });
        };

        this.txPower = <any>(<HTMLInputElement>document.getElementById("rssiSelector")).value;

        document.getElementById("rssiSelector").onchange = () => {

            this.txPower = <any>(<HTMLInputElement>document.getElementById("rssiSelector")).value;
            document.getElementById("txPower").textContent = this.txPower.toString();

            if (this.jsonData) {
                for (let k of this.jsonData) {
                    for (let s of k.signals) {
                        s.distance = this.calculateDistance(s.rssi, this.txPower);
                    }
                }
            }
        };

        document.getElementById("recalc").onclick = () => {
            this.calculatePositions();
        }

        document.getElementById("heatmapSelector").onchange = () => {

            var type = (<any>document.getElementById("heatmapAttrSelector")).value;

            ((<HeatmapRenderer>this.heatmapLayer.renderer).setField((<any>document.getElementById("heatmapSelector")).value + "_" + type));
            this.heatmapLayer.redraw();
        };

        document.getElementById("heatmapAttrSelector").onchange = () => {

            var type = (<any>document.getElementById("heatmapAttrSelector")).value;

            ((<HeatmapRenderer>this.heatmapLayer.renderer).setField((<any>document.getElementById("heatmapSelector")).value + "_" + type));
            this.heatmapLayer.redraw();
        };

        document.getElementById("heatmapMin").onchange = () => {
            (<HeatmapRenderer>this.heatmapLayer.renderer).setMinPixelIntensity((<any>document.getElementById("heatmapMin")).value);
            this.heatmapLayer.redraw();
        }

        document.getElementById("heatmapMax").onchange = () => {
            (<HeatmapRenderer>this.heatmapLayer.renderer).setMaxPixelIntensity((<any>document.getElementById("heatmapMax")).value);
            this.heatmapLayer.redraw();
        }

        document.getElementById("heatmapBlur").onchange = () => {
            (<HeatmapRenderer>this.heatmapLayer.renderer).setBlurRadius((<any>document.getElementById("heatmapBlur")).value);
            this.heatmapLayer.redraw();
        }

        document.getElementById("rssiCalibration").onclick = () => {
            this.createRssiCalibrationReport();
        }
        document.getElementById("drawTrilateration").onclick = () => {
            this.polygonLayer.setVisibility((<any>document.getElementById("drawTrilateration")).checked);
        }

        document.getElementById("drawResultPoints").onclick = () => {
            this.resultLayer.setVisibility((document.getElementById("drawResultPoints") as any).checked);
        }

        document.getElementById("umfeld").onchange = () => {

            this.changeUmfeld((document.getElementById("umfeld") as any).value);
        }

    }

    private readFile(input: any, proceed: (dataUrl: any) => void) {
        var files = input.files;

        var reader = new FileReader();

        reader.onload = (event: any) => {

            var dataUrl = event.target.result;

            proceed(dataUrl);



        }

        reader.readAsText(files[0]);
    }

    private changeUmfeld(ind: number) {
        if (this.beaconLayer)
            this.map.removeLayer(this.beaconLayer);

        if (this.grundrissLayer)
            this.map.removeLayer(this.grundrissLayer);

        this.beaconLayer = new FeatureLayer(this.config.serviceUrls[ind].beaconServiceUrl,
            { mode: FeatureLayer.MODE_SNAPSHOT, outFields: ["*"] });


        this.grundrissLayer = new FeatureLayer(this.config.serviceUrls[ind].umgebungServiceUrl, { mode: FeatureLayer.MODE_SNAPSHOT });

        this.map.addLayer(this.grundrissLayer);
        this.map.addLayer(this.beaconLayer);

    }

    private initializeLayers() {
        this.changeUmfeld(0);


        var layerDefinition = {
            "geometryType": "esriGeometryPoint",
            "fields": [{
                "name": "BUFF_DIST",
                "type": "esriFieldTypeInteger",
                "alias": "Buffer Distance"
            }]
        }
        var featureCollection = {
            layerDefinition: layerDefinition,
            featureSet: null
        };

        this.heatmapLayer = new FeatureLayer(featureCollection, { infoTemplate: null });
        this.heatmapLayer.htmlPopupType = FeatureLayer.POPUP_NONE;
        this.heatmapLayer.setRenderer(new HeatmapRenderer(this.config.heatmapProperties));

        this.heatmapLayer.setOpacity(0.5);


        this.map.addLayer(this.heatmapLayer);

        var simpleFeatureInfotemplateFunc = feature => {

            var template = "";
            for (let attr in feature.attributes) {
                template += "<b>" + attr + "</b>: " + feature.attributes[attr] + "<br/>";
            }
            return template;
        };

        this.measurePointLayer = new GraphicsLayer(<any>{
            infoTemplate: new InfoTemplate("Messpunkt", simpleFeatureInfotemplateFunc)
        });




        this.map.on("click", e => {
            this.onMapClick(e);
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
        symbolJson.outline.color = [128, 128, 128, 255]
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




    }


    calculatePositions() {

        var measureData = this.jsonData;

        this.distanceCorrection = parseInt((<any>document.getElementById("distanceCorrection")).value);
        this.distanceFilter = parseFloat((<any>document.getElementById("distanceFilter")).value);

        if ((<any>document.getElementById("proceesOnly5")).checked && this.jsonData.length > 100) {
            measureData = this.jsonData.slice(0, 100);
        }


        this.heatmapLayer.clear();
        this.measurePointLayer.clear();
        this.resultLayer.clear();
        this.polygonLayer.clear();

        var measureId: { [id: string]: Graphic } = {};
        var connectedFeatures: { [id: string]: Array<Graphic> } = {};

        for (let item of measureData) {

            var id = item.x.toString() + "_" + item.y.toString();

            console.log("processing "+ id);

            if (measureId[id] == null) {
                measureId[id] = new Graphic(new Point(item.x, item.y, this.map.spatialReference), null, { measureId: id });

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

        var latencyData = {"weightedAvg": "", "nearestPoint": "", trilateration: "", fingerprint: ""};
        var types = ["weightedAvg", "nearestPoint", "trilateration", "fingerprint"];

        console.log("processing statistics");

        for (let id in connectedFeatures) {
            var measurePoint = measureId[id];

            console.log("processing " + id);

            for (let f of connectedFeatures[id]) {
                f.attributes.distanceToOrigin = this.getDistanceFromPoints(measurePoint.geometry, f.geometry);
            }


            for (let t of types) {
                var ps = connectedFeatures[id].filter(a => a.attributes.type === t);
                var line = id + "\t";

                for (let i = 0; i <= 30; i++) {
                    var f = ps.filter(a => i * 1000 < a.attributes.delay && a.attributes.delay <= (i + 1) * 1000);
                    line += this.avg(f.map(s => s.attributes.distanceToOrigin), k => k) + "\t";
                }

                latencyData[t] += line + "\n";
            }

           
            var stats = this.getStats(measurePoint, connectedFeatures[id], "weightedAvg");
            mixin.mixin(stats, this.getStats(measurePoint, connectedFeatures[id], "nearestPoint"));
            mixin.mixin(stats, this.getStats(measurePoint, connectedFeatures[id], "trilateration"));
            mixin.mixin(stats, this.getStats(measurePoint, connectedFeatures[id], "fingerprint"));

            mixin.mixin(measurePoint.attributes, stats);

            this.measurePointLayer.add(measurePoint);
            this.heatmapLayer.add(new Graphic(measurePoint.geometry, null, measurePoint.attributes));

        }



        this.collectOverallStats(latencyData);


        this.heatmapLayer.redraw();
        this.resultLayer.redraw();
    }

    cleanUnusedSignals() {
        var beaconMinors = this.beaconLayer.graphics.map(t => t.attributes.Minor);
        for (let measurement of this.jsonData) {
            for (let i = measurement.signals.length - 1; i >= 0; i--) {
                if (beaconMinors.indexOf(measurement.signals[i].minor) < 0) {
                    measurement.signals.splice(i, 1);
                }
            }
        }
    }

    getDistanceFromPoints(p1: any, p2: any) {
        var poly1 = new Polyline(this.map.spatialReference);
        poly1.addPath([p1, p2]);

        return GeometryEngine.geodesicLength(poly1, "meters");
    }

    collectOverallStats(latencyData) {
        var types = ["weightedAvg", "nearestPoint", "trilateration", "fingerprint"];
        var attrs = ["_avgDistance", "_minDistance", "_maxDistance", "_delayOfMinDistance"];

        var currentRows = document.getElementsByClassName("statsrow");
        while (currentRows.length > 0) {
            currentRows.item(0).remove();
        }



        for (let typ of types) {

            var filtered = this.resultLayer.graphics.filter(t => t.attributes.type === typ);

            var html = `<td>${typ}</td>`;
            for (let att of attrs) {
                html += `<td>${this.avg(this.measurePointLayer.graphics, f => f.attributes[typ + att]).toFixed(2)} m </td>`
            }

            var overallAvg = this.avg(filtered, f => f.attributes["distanceToOrigin"]);
            var sttdev = Math.sqrt(this.varianz(filtered, f => f.attributes["distanceToOrigin"]));
            var normV = this.normVerteilung(filtered, f => f.attributes["distanceToOrigin"], -10, 10, 0.5);

            var raw = filtered.map(s => s.attributes["distanceToOrigin"]).join("\n");



            html += `<td>${overallAvg}</td><td>${sttdev}</td><td><textarea>${this.normToString(normV)}</textarea></td><td><textarea>${raw}</textarea><textarea>${latencyData[typ]}</textarea></td>`;

            var row = document.createElement("tr");
            row.innerHTML = html;
            row.className = "statsrow";
            document.getElementById("statsTable").appendChild(row);
        }
    }

    getConnectedFeatures(measureItem: MeasureDataItem): Array<Graphic> {

        if (measureItem.signals && measureItem.signals.length > 0) {
            var weightedAvg = this.getWeightedAvg(measureItem);
            var nearest = this.getNearestPoint(measureItem);
            var trilat = this.getTrilateration(measureItem);
            var fingerPrt = this.getFingerPrint(measureItem);

            var res = [];


            if (weightedAvg) res.push(weightedAvg);
            if (nearest) res.push(nearest);
            if (trilat) res.push(trilat);
            if (fingerPrt) res.push(fingerPrt);

            return res;
        }

        return [];

    }

    getWeightedAvg(measureItem: MeasureDataItem): Graphic {

        var filtered = measureItem.signals.filter(h => h.distance < this.distanceFilter);

        if (filtered.length > 0) {

            var latCounter = this.sum(filtered, item => this.getBeaconLat(item.minor) / item.distance);
            var lnCounter = this.sum(filtered, item => this.getBeaconLn(item.minor) / item.distance);
            var dividor = this.sum(filtered, item => 1 / item.distance);

            var lat = latCounter / dividor;
            var ln = lnCounter / dividor;

            return new Graphic(new Point(lat, ln, this.map.spatialReference), null, { type: "weightedAvg", delay: measureItem.delay });
        }
    }

    getNearestPoint(measureItem: MeasureDataItem): Graphic {
        var filtered = measureItem.signals.filter(h => h.distance < this.distanceFilter);
        var min = this.min(filtered, t => t.distance);

        var beacon = filtered.filter(s => s.distance === min);

        if (beacon.length > 0) {
            var beaconId = beacon[0].minor;

            return new Graphic(this.getBeacon(beaconId).geometry, null, {
                type: "nearestPoint", delay: measureItem.delay
            });
        }
    }

    getTrilateration(measureItem: MeasureDataItem): Graphic {
        var filtered = measureItem.signals.filter(h => h.distance < this.distanceFilter);
        var sorted = filtered.sort((a, b) => b.distance - a.distance);

        if (sorted.length > 0) {
            var farestBeacon = this.getBeacon(sorted[0].minor);
            var startingGeometry = GeometryEngine.geodesicBuffer(farestBeacon.geometry, sorted[0].distance, "meters");

            if (startingGeometry == null) console.log("starting geometry was null");

            for (var j = 1; j < sorted.length; j++) {
                var buffer = GeometryEngine.geodesicBuffer(this.getBeacon(sorted[j].minor).geometry, sorted[j].distance, "meters");

                if (buffer == null) {
                    console.log("buffer geometry was null")
                } else {
                    this.polygonLayer.add(new Graphic(<Polygon>buffer, null, {
                        type: "trilateration", delay: measureItem.delay, measureId: measureItem.x.toString() + "_" + measureItem.y.toString()
                    }));
                };

                try {

                    if (GeometryEngine.intersects(<any>buffer, <any>startingGeometry)) {
                        var intersection = <any>GeometryEngine.intersect(buffer, <any>startingGeometry);

                        if (intersection == null) {
                            console.log("buffer and start intersected, but intersection was null");
                        } else {
                            startingGeometry = intersection;
                        }

                    } else {
                        startingGeometry = buffer;
                    }
                } catch (e) {
                    console.log(buffer, startingGeometry);
                }
            }

            startingGeometry = <any>GeometryEngine.simplify(<any>startingGeometry);

            this.polygonLayer.add(new Graphic(<Polygon>startingGeometry, null, {
                type: "trilateration", delay: measureItem.delay, measureId: measureItem.x.toString() + "_" + measureItem.y.toString()
            }));

            return new Graphic(this.getCentroid(<Polygon>startingGeometry), null, {
                type: "trilateration", delay: measureItem.delay
            });
        }

    }

    getFingerPrint(measureItem: MeasureDataItem): Graphic {
        var minFpr: MeasureDataItem = null;
        var minDistance = 1000000;
        for (let fpr of this.fingerPrintReference) {
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
    }

    getFingerPrintDistance(measureItem1: MeasureDataItem, measureItem2: MeasureDataItem): number {

        var dist = 0;
        var matches = 0;

        for (let sig of measureItem1.signals) {
            var s = measureItem2.signals.filter(t => t.minor === sig.minor);

            if (s.length > 0) {
                dist += Math.abs(s[0].rssi - sig.rssi);
                matches++;
            }
        }

        if (matches >= 3) {
            return dist;
        } else {
            return 10000;
        }
    }

    getBeaconLat(beaconId: number): number {
        var beacon = this.getBeacon(beaconId);

        if (beacon)
            return (<Point>beacon.geometry).x
    }

    getBeaconLn(beaconId: number): number {
        var beacon = this.getBeacon(beaconId);
        if (beacon)
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

    varianz<T>(dat: Array<T>, selector: (T: T) => number): number {
        var avg2 = this.avg(dat, selector);
        return this.sum(dat, s => Math.pow(avg2 - selector(s), 2)) / dat.length;
    }

    normVerteilung<T>(dat: Array<T>, selector: (T: T) => number, start: number, stop: number, step: number): { [index: number]: number } {

        var stat: { [index: number]: number } = {};

        for (let j = start; j <= stop; j += step) {
            stat[j] = 0;
            for (let item of dat) {
                let val = selector(item);
                if (j <= val && val < (j + step)) stat[j]++;
            }
        }
        return stat;
    }

    normToString(stat: { [index: number]: number }): string {
        var str = "";

        for (let item in stat) {
            str += item + "\t" + stat[item] + "\n";
        }
        return str;
    }

    getStats(measurePoint: Graphic, positions: Array<Graphic>, type: string): any {
        var filtered = positions.filter(s => s.attributes.type === type);

        var stats = {}

        if (filtered.length > 0) {
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
        }

        return stats;
    }


    public calculateDistance(rssi: number, txPower: number): number {
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
    }

    private onMapClick(e) {
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
    }


    private createRssiCalibrationReport() {

        this.distanceCorrection = parseInt((<any>document.getElementById("distanceCorrection")).value);
        this.distanceFilter = parseFloat((<any>document.getElementById("distanceFilter")).value);


        var txPowers = [];
        var dists = {};
        for (let i = -58; i < -40; i++) {
            txPowers.push(i);

            dists[i] = [];
        }

        var measureIds = {};
        var allDeltas = {};

        for (let measurePoint of this.jsonData) {

            var id = measurePoint.x.toString() + "_" + measurePoint.y.toString();

            if (measureIds[id] == null) {
                measureIds[id] = { signals: [], x: measurePoint.x, y: measurePoint.y };
            }

            for (let sig of measurePoint.signals) {
                measureIds[id].signals.push(sig);
            }
        }

        for (let id in measureIds) {
            var measurePoint = measureIds[id];

            var collectedBeacons = {};

            for (let sig of measurePoint.signals) {
                if (collectedBeacons[sig.minor] == null) {
                    collectedBeacons[sig.minor] = [sig.rssi];
                } else {
                    collectedBeacons[sig.minor].push(sig.rssi);
                }
            }

            for (let beac in collectedBeacons) {
                var bec = this.getBeacon(parseInt(beac));
                var distanceBecMeasure = this.getDistanceFromPoints(new Point(measurePoint.x, measurePoint.y, this.map.spatialReference), bec.geometry);

                for (let txPower of txPowers) {

                    if (allDeltas[txPower] == null) allDeltas[txPower] = [];

                    var sss = [];

                    for (let k of collectedBeacons[beac]) {
                        var dist = this.calculateDistance(k, txPower);

                        if (0 - this.distanceFilter < dist && dist < this.distanceFilter) {
                            allDeltas[txPower].push(dist - distanceBecMeasure);
                            sss.push(dist);
                        }
                    }

                    if (sss.length <= 0) {
                        console.log("no data for tx" + txPower);
                    } else {
                        var distAvg = this.avg(sss, s => <number>s);
                        var deltaDist = distAvg - distanceBecMeasure;

                        dists[txPower].push(deltaDist);
                    }


                }

            }
        }

        var tab = document.createElement("table");
        for (let dist in dists) {

            let cur = dists[dist];

            var avg = this.avg(cur, s => <number>s);

            var avg2 = this.avg(allDeltas[dist], s => <number>s);
            var varianz = this.varianz(allDeltas[dist], s => <number>s);
            var stddev = Math.sqrt(varianz);

            var tr = document.createElement("tr");
            var td1 = document.createElement("td");
            td1.textContent = dist;

            var td2 = document.createElement("td");
            td2.textContent = avg.toFixed(2) + "/" + avg2.toFixed(2) + " / " + varianz.toFixed(2) + " / " + stddev.toFixed(2);

            tr.appendChild(td1);
            tr.appendChild(td2);
            tab.appendChild(tr);

            tr.style.cursor = "pointer";
            tr.onclick = () => {
                var stat = allDeltas[dist].join("\n");
                var i = document.createElement("textarea");
                i.value = stat;
                document.getElementById("calibrationresult").appendChild(i);

            };

        }

        document.getElementById("calibrationresult").innerHTML = "";
        document.getElementById("calibrationresult").appendChild(tab);

    }

}