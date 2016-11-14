package com.example.beku.bekubach;

import android.bluetooth.BluetoothAdapter;
import android.bluetooth.le.BluetoothLeScanner;
import android.bluetooth.le.ScanCallback;
import android.bluetooth.le.ScanFilter;
import android.bluetooth.le.ScanRecord;
import android.bluetooth.le.ScanResult;
import android.bluetooth.le.ScanSettings;
import android.util.Log;

import java.nio.ByteBuffer;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashMap;
import java.util.Map;
import java.util.Timer;
import java.util.TimerTask;
import java.util.UUID;

/**
 * Created by beku on 31.10.2016.
 */
public class BeaconManager extends ScanCallback {
    private BluetoothAdapter mBluetoothAdapter;
    private BluetoothLeScanner mBluetoothLeScanner;
    private ScanFilter mScanFilter;
    private ScanSettings mScanSettings;

    private String listenForUUID;

    private OnSignalChangedListener onSignalChangedListener;

    private HashMap<Integer, ArrayList<SignalInformation>> data;
    private Timer timer;

    public BeaconManager(){

        mBluetoothAdapter = BluetoothAdapter.getDefaultAdapter();
        mBluetoothLeScanner = mBluetoothAdapter.getBluetoothLeScanner();

        setScanSettings();
        setScanFilter();

    }

    public void startScan(final String listenForUUID){
        this.listenForUUID = listenForUUID;
        mBluetoothLeScanner.startScan(Arrays.asList(mScanFilter), mScanSettings, this);

        timer = new Timer();
        timer.scheduleAtFixedRate(new TimerTask() {
            @Override
            public void run() {

                ArrayList<BeaconSignal> signals = new ArrayList<BeaconSignal>();

                if(data != null){

                    for(Map.Entry<Integer, ArrayList<SignalInformation>> entry : data.entrySet()){
                        double totalDist = 0;
                        double totalRssi = 0;
                        for(SignalInformation d : entry.getValue()){
                            totalDist += d.distance;
                            totalRssi += d.rssi;
                        }
                        double avgDist = totalDist / entry.getValue().size();
                        double avgRssi = totalRssi / entry.getValue().size();

                        signals.add(new BeaconSignal(entry.getKey(), avgDist, avgRssi));
                    }
                }

                if(onSignalChangedListener != null)
                    onSignalChangedListener.onSignalChanged(signals);

                data = new HashMap<Integer, ArrayList<SignalInformation>>();
            }
        }, 1000, 1000);
    }


    @Override
    public void onScanResult(int callbackType, ScanResult result) {

        if(data == null){
            data = new HashMap<Integer, ArrayList<SignalInformation>>();
        }

        Log.d("onscan", "ON scan result");

        ScanRecord mScanRecord = result.getScanRecord();

        byte[] manufacturerData = mScanRecord.getBytes();

        String uuid = getBeaconUUID(manufacturerData);

        if(uuid.toUpperCase().equals(listenForUUID.toUpperCase())) {

            int minor = getMajorMinorData(manufacturerData, 27);
            int mRssi = result.getRssi();

            double distance = calculateDistance(-58, mRssi);


            if(!data.containsKey(minor))
                data.put(minor, new ArrayList<SignalInformation>());

            SignalInformation sig = new SignalInformation();
            sig.distance = distance;
            sig.rssi = mRssi;
            data.get(minor).add(sig);

            Log.d("distance", String.valueOf(minor));


            if(onSignalChangedListener != null){
                //onSignalChangedListener.onSignalChanged("Beacon " + minor +": " + String.valueOf(distance )+ " m " + mRssi);
            }
        }
    }
    private String getBeaconUUID(byte[] data){
        StringBuilder strBuilder = new StringBuilder();

        if(data != null && data.length > 24){
            for(int i = 9; i <= 24; i ++){
                strBuilder.append(String.format("%02X", data[i]));
            }
        }

        return strBuilder.toString();
    }

    private int getMajorMinorData(byte[] data, int startByte){
        int major = 0;
        int stelle = 256;

        for(int i = startByte; i <= startByte + 1; i ++){
            major += (stelle) * data[i];
            stelle-= 255;
        }
        return major;
    }

    private void setScanFilter() {
        ScanFilter.Builder mBuilder = new ScanFilter.Builder();
/*        ByteBuffer mManufacturerData = ByteBuffer.allocate(23);
        ByteBuffer mManufacturerDataMask = ByteBuffer.allocate(24);
        byte[] uuid = getIdAsByte(UUID.fromString("fda50693-a4e2-4fb1-afcf-c6eb07647825"));

        mManufacturerData.put(0, (byte)0xBE);
        mManufacturerData.put(1, (byte)0xAC);

        for (int i=2; i<=17; i++) {
            mManufacturerData.put(i, uuid[i-2]);
        }
        for (int i=0; i<=17; i++) {
            mManufacturerDataMask.put((byte)0x01);
        }
        // mBuilder.setManufacturerData(224, mManufacturerData.array(), mManufacturerDataMask.array());*/

        mScanFilter = mBuilder.build();
    }

    private void setScanSettings() {
        ScanSettings.Builder mBuilder = new ScanSettings.Builder();
        mBuilder.setReportDelay(0);
        mBuilder.setScanMode(ScanSettings.SCAN_MODE_LOW_LATENCY);
        mScanSettings = mBuilder.build();
    }

    public byte[] getIdAsByte(UUID uuid)
    {
        ByteBuffer bb = ByteBuffer.wrap(new byte[16]);
        bb.putLong(uuid.getMostSignificantBits());
        bb.putLong(uuid.getLeastSignificantBits());
        return bb.array();
    }

    public double calculateDistance(int txPower, double rssi) {
        if (rssi == 0) {
            return -1.0; // if we cannot determine accuracy, return -1.
        }
        double ratio = rssi*1.0/txPower;
        if (ratio < 1.0) {
            return Math.pow(ratio,10);
        }
        else {
            double accuracy =  (0.89976)*Math.pow(ratio,7.7095) + 0.111;
            return accuracy;
        }
    }

    public void setOnSignalChangedListener(OnSignalChangedListener onSignalChangedListener) {
        this.onSignalChangedListener = onSignalChangedListener;
    }
}

class SignalInformation{

    public double distance;
    public double rssi;

}
