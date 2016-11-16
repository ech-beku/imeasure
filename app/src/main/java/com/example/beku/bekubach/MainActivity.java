package com.example.beku.bekubach;

import android.Manifest;
import android.animation.ObjectAnimator;
import android.app.AlertDialog;
import android.content.DialogInterface;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.database.DataSetObserver;
import android.os.Build;
import android.os.Environment;
import android.support.v7.app.AppCompatActivity;
import android.os.Bundle;
import android.util.Log;
import android.view.View;
import android.view.ViewGroup;
import android.widget.ArrayAdapter;
import android.widget.Spinner;
import android.widget.SpinnerAdapter;

import java.io.File;
import java.util.ArrayList;

public class MainActivity extends AppCompatActivity {
    private static final int PERMISSION_REQUEST_COARSE_LOCATION = 1;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);


        boolean doesACheck = false;

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            // Android M Permission check 
            if (this.checkSelfPermission(Manifest.permission.ACCESS_COARSE_LOCATION) != PackageManager.PERMISSION_GRANTED) {

                doesACheck = true;

            final AlertDialog.Builder builder = new AlertDialog.Builder(this);
                builder.setTitle("This app needs location access");
                builder.setMessage("Please grant location access so this app can detect beacons.");
                builder.setPositiveButton(android.R.string.ok, null);
                builder.setOnDismissListener(new DialogInterface.OnDismissListener() {
                    @Override
                    public void onDismiss(DialogInterface dialog) {
                        requestPermissions(new String[]{Manifest.permission.ACCESS_COARSE_LOCATION}, PERMISSION_REQUEST_COARSE_LOCATION);
                    }
                });


                builder.show();
            }


            if (this.checkSelfPermission(Manifest.permission.WRITE_EXTERNAL_STORAGE) != PackageManager.PERMISSION_GRANTED) {

                doesACheck = true;

                final AlertDialog.Builder builder = new AlertDialog.Builder(this);
                builder.setTitle("This app needs location access");
                builder.setMessage("Please grant location access so this app can detect beacons.");
                builder.setPositiveButton(android.R.string.ok, null);
                builder.setOnDismissListener(new DialogInterface.OnDismissListener() {
                    @Override
                    public void onDismiss(DialogInterface dialog) {
                        requestPermissions(new String[]{Manifest.permission.WRITE_EXTERNAL_STORAGE}, PERMISSION_REQUEST_COARSE_LOCATION);
                    }
                });


                builder.show();
            }
        }

if(doesACheck == false) {
    File downloadFolderPath = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS);

    File[] files = downloadFolderPath.listFiles();

    ArrayList<String> fileList = new ArrayList<String>();
    fileList.add("-");
    for (File file : files) {
        if (file.getName().indexOf("iBeaconLOG") == 0) {
            fileList.add(file.getName());
        }
    }

    ArrayAdapter<String> entryAdapter = new ArrayAdapter<String>(this, android.R.layout.simple_spinner_item, fileList);
    entryAdapter.setDropDownViewResource(android.R.layout.simple_spinner_dropdown_item);

    ((Spinner) findViewById(R.id.existingMeasureSpinner)).setAdapter(entryAdapter);
}
    }

    @Override
    public void onRequestPermissionsResult(int requestCode,
                                           String permissions[], int[] grantResults) {
        switch (requestCode) {
            case PERMISSION_REQUEST_COARSE_LOCATION: {
                if (grantResults[0] == PackageManager.PERMISSION_GRANTED) {
                    Log.d("TAG", "coarse location permission granted");
                } else {
                    final AlertDialog.Builder builder = new AlertDialog.Builder(this);
                    builder.setTitle("Functionality limited");
                    builder.setMessage("Since location access has not been granted, this app will not be able to discover beacons when in the background.");
                    builder.setPositiveButton(android.R.string.ok, null);
                    builder.setOnDismissListener(new DialogInterface.OnDismissListener() {

                        @Override
                        public void onDismiss(DialogInterface dialog) {
                        }

                    });
                    builder.show();
                }
                return;
            }
        }
    }



    public void startMeasure(View sender){
        Spinner messpunktSpinner = (Spinner) findViewById(R.id.messpunkt_spinner);
        Spinner messdauerSpinner = (Spinner) findViewById(R.id.messdauer_spinner);
        Intent i = new Intent(MainActivity.this, MeasureActivity.class);
        i.putExtra("measure_points", String.valueOf(messpunktSpinner.getSelectedItem()));
        i.putExtra("measure_duration", String.valueOf(messdauerSpinner.getSelectedItem()));
        i.putExtra("existing_measure", String.valueOf(((Spinner)findViewById(R.id.existingMeasureSpinner)).getSelectedItem()));
        startActivity(i);

    }
}
