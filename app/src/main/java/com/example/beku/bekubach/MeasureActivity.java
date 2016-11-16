package com.example.beku.bekubach;


import android.bluetooth.BluetoothAdapter;
import android.bluetooth.le.BluetoothLeScanner;
import android.bluetooth.le.ScanCallback;
import android.bluetooth.le.ScanFilter;
import android.bluetooth.le.ScanRecord;
import android.bluetooth.le.ScanResult;
import android.bluetooth.le.ScanSettings;
import android.net.Uri;
import android.os.SystemClock;
import android.support.v4.widget.TextViewCompat;
import android.support.v7.app.AppCompatActivity;
import android.os.Bundle;
import android.support.v7.widget.ButtonBarLayout;
import android.util.Log;
import android.view.View;
import android.widget.Button;
import android.widget.TextView;

import com.android.internal.util.Predicate;
import com.esri.android.map.FeatureLayer;
import com.esri.android.map.GraphicsLayer;
import com.esri.android.map.MapView;
import com.esri.android.map.ags.ArcGISFeatureLayer;
import com.esri.android.map.event.OnStatusChangedListener;
import com.esri.core.geometry.Point;
import com.esri.core.geometry.SpatialReference;
import com.esri.core.map.Graphic;
import com.esri.core.renderer.SimpleRenderer;
import com.esri.core.renderer.UniqueValue;
import com.esri.core.renderer.UniqueValueRenderer;
import com.esri.core.symbol.SimpleMarkerSymbol;
import com.esri.core.symbol.TextSymbol;


import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.io.IOException;
import java.io.InputStream;
import java.nio.ByteBuffer;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.HashMap;
import java.util.Objects;
import java.util.Timer;
import java.util.TimerTask;
import java.util.UUID;

public class MeasureActivity extends AppCompatActivity implements OnSignalChangedListener {


    private MapView mapView;
    private GraphicsLayer measurePointLayer;
    private GraphicsLayer measurePointLabelLayer;

    private GraphicsLayer selectionMeasurePointLayer;

    private Graphic selectedMeasurePoint;

    private ArrayList<Graphic> measurePoints;
    private HashMap<Graphic, Integer> measurePointsIdMap;


    private BeaconManager beaconManager;

    private LogManager logManager;
    private double measureDuration;
    private long measureStart;
    private Timer measureTimer;


    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_measure);

        beaconManager = new BeaconManager();

        mapView = (MapView) findViewById(R.id.MapView);

        ArcGISFeatureLayer l = new ArcGISFeatureLayer("http://services7.arcgis.com/9lVYHAWgmOjTa6bn/arcgis/rest/services/Umgebung_1/FeatureServer/3", ArcGISFeatureLayer.MODE.SNAPSHOT);

        mapView.addLayer(l);

        measurePointLayer = new GraphicsLayer();
        mapView.addLayer(measurePointLayer);


        UniqueValueRenderer measurePointRenderer = null;
        try {



            measurePointRenderer = new UniqueValueRenderer();
            measurePointRenderer.setField1("status");
            UniqueValue uv1 = new UniqueValue();
            uv1.setValue(new Object[]{"keine_messung"});
            uv1.setSymbol(new SimpleMarkerSymbol(getColor(R.color.red), 5, SimpleMarkerSymbol.STYLE.CIRCLE));
            measurePointRenderer.addUniqueValue(uv1);


            UniqueValue uv2 = new UniqueValue();
            uv2.setValue(new Object[]{"messung_aktiv"});
            uv2.setSymbol(new SimpleMarkerSymbol(getColor(R.color.selection), 5, SimpleMarkerSymbol.STYLE.CIRCLE));
            measurePointRenderer.addUniqueValue(uv2);

            UniqueValue uv3 = new UniqueValue();
            uv3.setValue(new Object[]{"messung_complete"});
            uv3.setSymbol(new SimpleMarkerSymbol(getColor(R.color.completed), 5, SimpleMarkerSymbol.STYLE.CIRCLE));
            measurePointRenderer.addUniqueValue(uv3);

            measurePointLayer.setRenderer(measurePointRenderer);

        } catch (Exception e) {
            e.printStackTrace();
        }

        logManager = new LogManager(getIntent().getStringExtra("existing_measure"));

        ArrayList<Integer> existingMeasures = logManager.getMeasuredObjectIds();

        measureDuration = new Double(getIntent().getStringExtra("measure_duration"));

        String jsonString = loadJSONFromAsset(getIntent().getStringExtra("measure_points") + ".json");

        measurePointsIdMap = new HashMap<Graphic, Integer>();
        measurePoints = new ArrayList<Graphic>();

        measurePointLabelLayer = new GraphicsLayer();
        mapView.addLayer(measurePointLabelLayer);

        selectionMeasurePointLayer = new GraphicsLayer();
        mapView.addLayer(selectionMeasurePointLayer);

        try {
            JSONObject json = new JSONObject(jsonString);

            JSONArray features = json.getJSONArray("features");

            for (int i = 0; i < features.length(); i++) {

                JSONObject feature = features.getJSONObject(i);
                JSONObject geometry = feature.getJSONObject("geometry");
                double x = geometry.getDouble("x");
                double y = geometry.getDouble("y");

                HashMap<String, Object> attributes = new HashMap<String, Object>();


                int objId = existingMeasures.indexOf(feature.getJSONObject("attributes").getInt("OBJECTID"));

                if(objId >= 0){
                    attributes.put("status", "messung_complete");
                }else{
                    attributes.put("status", "keine_messung");
                }

                attributes.put("OBJECTID", feature.getJSONObject("attributes").getString("OBJECTID"));

                Graphic g = new Graphic(new Point(x, y, SpatialReference.WKID_WGS84_WEB_MERCATOR), null, attributes);
                Graphic textGraphic = new Graphic(new Point(x, y, SpatialReference.WKID_WGS84_WEB_MERCATOR), new TextSymbol(10, feature.getJSONObject("attributes").getString("OBJECTID"), R.color.black));

                measurePointLabelLayer.addGraphic(textGraphic);

                int graphicId = measurePointLayer.addGraphic(g);
                measurePointsIdMap.put(g, new Integer(graphicId));

                if(objId < 0){
                    measurePoints.add(g);
                }
            }


        } catch (JSONException e) {
            e.printStackTrace();
        }


        mapView.setOnStatusChangedListener(new OnStatusChangedListener() {
            @Override
            public void onStatusChanged(Object o, STATUS status) {
                if (status == STATUS.INITIALIZED) {
                    mapView.setExtent(measurePoints.get(0).getGeometry());


                    beaconManager.startScan("fda50693a4e24fb1afcfc6eb07647825");

                }
            }
        });


        beaconManager.setOnSignalChangedListener(this);


    }
    @Override
    public void onSignalChanged(final String data) {

        MeasureActivity.this.runOnUiThread(new Runnable() {
            @Override
            public void run() {
                ((TextView) findViewById(R.id.logView)).setText(data);
            }
        });

    }

    @Override
    public void onSignalChanged(final ArrayList<BeaconSignal> signals) {
        Collections.sort(signals);

        StringBuilder e = new StringBuilder();
        for (BeaconSignal s : signals) {
            e.append("Beacon " + String.valueOf(s.getMinor()) + ": " + String.format("%.2f", s.getDistance()) + "\n");
        }
        if (selectedMeasurePoint != null) {
            MeasureActivity.this.runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    logManager.Log(signals, selectedMeasurePoint);
                }
            });
        }

        onSignalChanged(e.toString());

    }

    public void nextMeasurePoint(View sender) {

        if(measurePoints.size() > 0){

            double ind = measurePoints.size() * Math.random();
            int nextIndex = (int) Math.floor(ind);

            selectedMeasurePoint = measurePoints.get(nextIndex);

            Point p = (Point) selectedMeasurePoint.getGeometry();

            Graphic selectionLayer = new Graphic(new Point(p.getX(), p.getY(), SpatialReference.WKID_WGS84_WEB_MERCATOR),
                    new SimpleMarkerSymbol(getColor(R.color.selection), 12, SimpleMarkerSymbol.STYLE.DIAMOND));

            selectionMeasurePointLayer.removeAll();
            selectionMeasurePointLayer.addGraphic(selectionLayer);

            mapView.centerAt((Point) selectedMeasurePoint.getGeometry(), false);

            checkButtonState();
        }

    }

    public String loadJSONFromAsset(String assetName) {
        String json = null;
        try {

            InputStream is = getAssets().open(assetName);

            int size = is.available();

            byte[] buffer = new byte[size];

            is.read(buffer);

            is.close();

            json = new String(buffer, "UTF-8");


        } catch (IOException ex) {
            ex.printStackTrace();
            return null;
        }
        return json;

    }

    public void startLog(View v) {
        logManager.start();
        checkButtonState();

        measureStart = System.currentTimeMillis();

        measureTimer = new Timer();
        measureTimer.scheduleAtFixedRate(new TimerTask() {
            @Override
            public void run() {
                MeasureActivity.this.runOnUiThread(new Runnable() {
                    @Override
                    public void run() {
                        if ((System.currentTimeMillis() - measureStart) / 1000 > measureDuration) {
                            endLog(null);




                        }

                        ((TextView) findViewById(R.id.timerLog)).setText("Verbleibend: " + String.valueOf(measureDuration - Math.floor((System.currentTimeMillis() - measureStart) / 1000 )) + "s");
                    }
                });
            }

        }, 1000, 1000);

    }

    public void endLog(View v) {
        logManager.stop(this);
        checkButtonState();
        measureTimer.cancel();

        if(selectedMeasurePoint != null){

            HashMap<String, Object> attrs = (HashMap<String, Object>) selectedMeasurePoint.getAttributes();
            attrs.remove("status");
            attrs.put("status", "messung_complete");

            measurePointLayer.updateGraphic(measurePointsIdMap.get(selectedMeasurePoint), attrs);

            measurePoints.remove(selectedMeasurePoint);

        }

    }

    private void checkButtonState(){
        ((Button)findViewById(R.id.startMeasureButton)).setEnabled(!logManager.isLogging() && selectedMeasurePoint != null);
        ((Button)findViewById(R.id.endMeasureButton)).setEnabled(logManager.isLogging());

        ((Button) findViewById(R.id.nextMeasureButton)).setEnabled(!logManager.isLogging());
    }

}
