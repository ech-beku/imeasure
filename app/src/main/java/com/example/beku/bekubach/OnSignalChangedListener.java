package com.example.beku.bekubach;

import java.util.ArrayList;

/**
 * Created by beku on 31.10.2016.
 */
public interface OnSignalChangedListener {

    void onSignalChanged(String data);

    void onSignalChanged(ArrayList<BeaconSignal> signals);
}
