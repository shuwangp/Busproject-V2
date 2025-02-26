import { useEffect, useState } from "react";
import { AppState, PermissionsAndroid, Platform } from "react-native";
import Geolocation from "react-native-geolocation-service";

const useUserLocation = () => {
    const [userLocation, setUserLocation] = useState(null);
    const [error, setError] = useState(null);

    useEffect(() => {
        let watchId = null;

        const startWatchingLocation = () => {
            watchId = Geolocation.watchPosition(
                position => {
                    setUserLocation({
                        latitude: position.coords.latitude,
                        longitude: position.coords.longitude,
                    });
                },
                error => {
                    console.log("ไม่สามารถดึง GPS ได้:", error);
                    setError(error);
                },
                { enableHighAccuracy: true, interval: 5000, distanceFilter: 10 }
            );
        };

        const requestLocationPermission = async () => {
            if (Platform.OS === "android") {
                try {
                    const granted = await PermissionsAndroid.request(
                        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
                        {
                            title: "ต้องการเข้าถึงตำแหน่งของคุณ",
                            message: "แอปต้องการใช้ GPS เพื่อคำนวณตำแหน่งของคุณ",
                            buttonNeutral: "ถามอีกครั้งภายหลัง",
                            buttonNegative: "ปฏิเสธ",
                            buttonPositive: "อนุญาต",
                        }
                    );

                    if (granted === PermissionsAndroid.RESULTS.GRANTED) {
                        console.log("ได้รับอนุญาตให้ใช้ GPS");
                        startWatchingLocation();
                    } else {
                        console.log("ผู้ใช้ปฏิเสธการเข้าถึง GPS");
                        setError("Permission Denied");
                    }
                } catch (err) {
                    console.warn("เกิดข้อผิดพลาดในการขออนุญาต:", err);
                    setError(err);
                }
            } else {
                startWatchingLocation(); 
            }
        };

        const handleAppStateChange = (nextAppState) => {
            if (nextAppState === "active") {
                requestLocationPermission();
            }
        };

    
        const subscription = AppState.addEventListener("change", handleAppStateChange);

        return () => {
            if (watchId !== null) {
                Geolocation.clearWatch(watchId); 
            }
            subscription.remove(); 
        };
    }, []);

    return { userLocation, error };
};

export default useUserLocation;