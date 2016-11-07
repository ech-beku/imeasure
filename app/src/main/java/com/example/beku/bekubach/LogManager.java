package com.example.beku.bekubach;

import android.app.DownloadManager;
import android.content.Context;
import android.content.SharedPreferences;
import android.os.Environment;
import android.util.Log;
import android.widget.Toast;

import com.esri.android.map.GraphicsLayer;
import com.esri.core.geometry.Point;
import com.esri.core.map.Graphic;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.File;
import java.io.FileNotFoundException;
import java.io.FileReader;
import java.io.FileWriter;
import java.io.IOException;
import java.io.OutputStreamWriter;
import java.security.Timestamp;
import java.util.ArrayList;
import java.util.Date;
import java.util.HashMap;

/**
 * Created by beku on 31.10.2016.
 */
public class LogManager {

    private boolean shouldLog;
    private long startDate;

    private JSONArray activeLogItems;


    public LogManager(String existing_measure) {

        activeLogItems = new JSONArray();

        if (existing_measure != "-") {
            File file = new File(Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS), existing_measure);

            //Read text from file
            StringBuilder text = new StringBuilder();

            try {
                BufferedReader br = new BufferedReader(new FileReader(file));
                String line;

                while ((line = br.readLine()) != null) {
                    text.append(line);
                    text.append('\n');
                }
                br.close();
            } catch (IOException e) {
                //You'll need to add proper error handling here
            }

            try {
                activeLogItems = new JSONArray(text.toString());
            } catch (JSONException e) {
                e.printStackTrace();
            }
        }

        shouldLog = false;
    }

    public boolean isLogging() {
        return shouldLog;
    }

    public void start() {
        shouldLog = true;
        startDate = System.currentTimeMillis();
    }

    public void stop(Context context) {
        shouldLog = false;

        writeToFile(activeLogItems.toString(), context);
    }

    private void writeToFile(String data, Context context) {
        try {

            android.text.format.DateFormat df = new android.text.format.DateFormat();
            String fileName = df.format("yyyyMMddhhmmss", new java.util.Date()).toString();

            File downloadFolder = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS);

            String fname = "iBeaconLOG_" + fileName + ".json";

            File kmlDoc = new File(downloadFolder, fname);
            kmlDoc.setReadable(true);

            FileWriter fw = new FileWriter(kmlDoc, true);
            fw.write(data);
            fw.flush();
            fw.close();

            DownloadManager d = (DownloadManager) context.getSystemService(Context.DOWNLOAD_SERVICE);
            d.addCompletedDownload(fname, "KML Download", true, "application/xhtml+xml", kmlDoc.getAbsolutePath(), kmlDoc.length(), true);

            Toast.makeText(context,
                    "Log saved...",
                    Toast.LENGTH_SHORT).show();

        } catch (IOException e) {
            Log.e("Exception", "File write failed: " + e.toString());
        }
    }

    public void Log(ArrayList<BeaconSignal> signals, Graphic selectedPosition) {
        if (shouldLog) {

            JSONObject measurePointLocation = new JSONObject();
            JSONArray sigs = new JSONArray();

            for (BeaconSignal s : signals) {
                sigs.put(s.toJson());
            }

            try {
                measurePointLocation.put("x", ((Point) selectedPosition.getGeometry()).getX());
                measurePointLocation.put("y", ((Point) selectedPosition.getGeometry()).getY());

                measurePointLocation.put("objectid", new Integer(String.valueOf(selectedPosition.getAttributeValue("OBJECTID"))));

                measurePointLocation.put("delay", (System.currentTimeMillis() - startDate));
                measurePointLocation.put("signals", sigs);

                activeLogItems.put(measurePointLocation);

            } catch (JSONException e) {
                e.printStackTrace();
            }


        }
    }

    public ArrayList<Integer> getMeasuredObjectIds() {
        ArrayList<Integer> measuredIds = new ArrayList<Integer>();
        try {

            for (int i = 0; i < activeLogItems.length(); i++) {
                JSONObject o = null;
                o = activeLogItems.getJSONObject(i);
                measuredIds.add(o.getInt("objectid"));
            }
        } catch (JSONException e) {
            e.printStackTrace();
        }

        return measuredIds;
    }


}
