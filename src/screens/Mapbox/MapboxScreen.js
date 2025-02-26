import React, { useEffect, useState, useCallback, useMemo } from "react";
import { StyleSheet, View, Text, Modal, TouchableOpacity, ActivityIndicator, Animated, Vibration } from "react-native";
import MapboxGL from "@rnmapbox/maps";
import Directions from "@mapbox/mapbox-sdk/services/directions";
import MaterialCommunityIcons from "react-native-vector-icons/MaterialCommunityIcons";
import { useNavigation } from "@react-navigation/native";
import { getDatabase, ref, onValue, off } from "firebase/database";
import { app } from "./firebaseConfig";
import useUserLocation from "../useUserLocation";
import { getBusLocation } from "./Firebase";
import { fetchMatrixData } from "./Matrix";

const tokenmapbox = "pk.eyJ1IjoicHVuY2gxMSIsImEiOiJjbTV0Y3k1ZjgwdmVqMm1weDA0MDMxMjF5In0.lSC2Xlg6RdF2VoVjAn5lbg";
MapboxGL.setAccessToken(tokenmapbox);

const directionsClient = Directions({ accessToken: tokenmapbox });

const markerList = [
    { location: 1, latitude: 19.022878, longitude: 99.895261, title: "จุดขึ้นรถประตู: 3", description: "ตำแหน่งประตู 3" },
    { location: 2, latitude: 19.026814, longitude: 99.899585, title: "จุดขึ้นรถ: ICT", description: "จุดขึ้นรถ ICT" },
    { location: 3, latitude: 19.030018, longitude: 99.897697, title: "จุดขึ้นรถตรงข้ามคณะ: วิทยาศาสตร์", description: "ตำแหน่งวิทยาศาสตร์" },
    { location: 4, latitude: 19.029054, longitude: 99.896055, title: "จุดขึ้นรถตรงข้ามดึก: BU", description: "ตรงข้ามดึก BU" },
    { location: 5, latitude: 19.029565, longitude: 99.895740, title: "จุดขึ้นรถหน้าดึก: BU", description: "หน้าดึก BU" },
    { location: 6, latitude: 19.030674, longitude: 99.901234, title: "จุดขึ้นรถหน้าคณะดึกวิศวะ: BU", description: "หน้าคณะวิศวะ" },
    { location: 7, latitude: 19.028548, longitude: 99.899827, title: "จุดขึ้นรถหน้าคณะ: ICT", description: "หน้าคณะ ICT" },
];

const App = () => {
    const { userLocation, error } = useUserLocation();
    const [routeGeoJSON, setRouteGeoJSON] = useState(null);
    const [isModalVisible, setModalVisible] = useState(false);
    const [selectedMarker, setSelectedMarker] = useState(null);
    const [locationPermission, setLocationPermission] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [busLocation, setBusLocation] = useState(null);
    const [isFirebaseLoading, setIsFirebaseLoading] = useState(true);
    const navigation = useNavigation();
    const [distanceToBus, setDistanceToBus] = useState(null);
    const [showNotification, setShowNotification] = useState(false);
    const translateY = useState(new Animated.Value(200))[0];

    useEffect(() => {
        const requestPermission = async () => {
            try {
                const granted = await MapboxGL.requestAndroidLocationPermissions();
                setLocationPermission(granted);
            } catch (error) {
                console.error("Permission error:", error);
            }
        };
        requestPermission();
    }, []);

    useEffect(() => {
        if (busLocation && userLocation) {
            fetchMatrixData(userLocation, busLocation, setDistanceToBus, tokenmapbox);
        }
    }, [busLocation, userLocation]);

    useEffect(() => {
        const unsubscribe = getBusLocation(setBusLocation);
        return () => unsubscribe();
    }, []);

    useEffect(() => {
        if (distanceToBus !== null) {
            if (distanceToBus < 500) {
                if (!showNotification) {
                    setShowNotification(true);
                    Vibration.vibrate();
                    Animated.timing(translateY, { toValue: 0, duration: 500, useNativeDriver: true }).start();
                }
            } else {
                setShowNotification(false);
                Animated.timing(translateY, { toValue: 200, duration: 500, useNativeDriver: true }).start();
            }
        }
    }, [distanceToBus, translateY, showNotification]);

    const fetchRoute = useCallback(async () => {
        setIsLoading(true);
        const waypoints = [
            ...markerList.map((marker) => ({
                coordinates: [marker.longitude, marker.latitude],
            })),
            {
                coordinates: [markerList[0].longitude, markerList[0].latitude],
            },
        ];
        try {
            const response = await directionsClient
                .getDirections({
                    profile: "driving",
                    waypoints,
                    geometries: "geojson",
                    overview: "full",
                })
                .send();
            setRouteGeoJSON(response.body.routes[0].geometry);
        } catch (error) {
            console.error("Error fetching directions:", error);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        const db = getDatabase(app);
        const busRef = ref(db, 'bus_data/latest');
        const onValueChange = onValue(busRef, (snapshot) => {
            if (snapshot.exists()) {
                const data = snapshot.val();
                setBusLocation({
                    latitude: data.latitude,
                    longitude: data.longitude,
                    personCount: data.personCount,
                });
            }
            setIsFirebaseLoading(false);
        });

        return () => off(busRef, 'value', onValueChange);
    }, []);

    useEffect(() => {
        if (!locationPermission) return;
        fetchRoute();
    }, [locationPermission, fetchRoute]);

    const handleMarkerPress = (marker) => {
        setSelectedMarker(marker);
        setModalVisible(true);
    };

    const busLocationMemo = useMemo(() => busLocation, [busLocation]);
    const routeGeoJSONMemo = useMemo(() => routeGeoJSON, [routeGeoJSON]);

    return (
        <View style={{ flex: 1 }}>
            <TouchableOpacity style={styles.closeIcon} onPress={() => navigation.navigate("HomeScreen")}>
                <View style={styles.closeIconContainer}>
                    <MaterialCommunityIcons name="close" size={30} color="#000" />
                </View>
            </TouchableOpacity>

            <MapboxGL.MapView style = {styles.map}
                zoomEnabled={true}
                rotateEnabled={true}
                styleURL="mapbox://styles/mapbox/outdoors-v12"
                scaleBarEnabled={false}
            >
                <MapboxGL.Camera
                    zoomLevel={15}
                    centerCoordinate={[99.897171, 19.029877]}
                    pitch={10}
                    animationMode="flyTo"
                    animationDuration={1000}
                />
                {markerList.map((marker) => (
                    <MapboxGL.PointAnnotation
                        key={marker.location}
                        id={`marker-${marker.location}`}
                        coordinate={[marker.longitude, marker.latitude]}
                        onSelected={() => handleMarkerPress(marker)}
                    >
                        <View style={styles.markerContainer}>
                            <MaterialCommunityIcons name="bus-stop-covered" size={25} color="#000" />
                        </View>
                    </MapboxGL.PointAnnotation>
                ))}
                {busLocationMemo && (
                    <MapboxGL.PointAnnotation
                        id="bus-location"
                        coordinate={[busLocationMemo.longitude, busLocationMemo.latitude]}
                    >
                        <View style={styles.busMarkerContainer}>
                            <MaterialCommunityIcons name="bus" size={30} color="#FF0000" />
                        </View>
                    </MapboxGL.PointAnnotation>
                )}
                {userLocation && (
                    <MapboxGL.PointAnnotation
                        id="user-location"
                        coordinate={[userLocation.longitude, userLocation.latitude]}
                    >
                        <View style={{ backgroundColor: "blue", borderRadius: 10, padding: 5 }}>
                            <Text style={{ color: "white" }}>คุณอยู่ที่นี่</Text>
                        </View>
                    </MapboxGL.PointAnnotation>
                )}
                {routeGeoJSONMemo && (
                    <MapboxGL.ShapeSource id="Line1" shape={routeGeoJSONMemo}>
                        <MapboxGL.LineLayer
                            id="routeLine"
                            style={{
                                lineColor: "red",
                                lineWidth: 4,
                                lineJoin: "round",
                                lineCap: "round",
                                lineBlur: 0.5,
                            }}
                        />
                    </MapboxGL.ShapeSource>
                )}
            </MapboxGL.MapView>

            {isLoading && (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color="#6200EA" />
                </View>
            )}

            <Animated.View
                style={{
                    transform: [{ translateY }],
                    position: "absolute",
                    bottom: 0,
                    left: 0,
                    right: 0,
                    backgroundColor: "#6200EA",
                    padding: 10,
                    alignItems: "center",
                }}
            >
                <Text style={{ color: "white" }}>รถเมล์ใกล้ถึง: {distanceToBus} เมตร</Text>
                <TouchableOpacity onPress={() => setShowNotification(false)}>
                    <Text style={{ color: "white" }}>ปิด</Text>
                </TouchableOpacity>
            </Animated.View>

            {isModalVisible && selectedMarker && (
                <Modal transparent={true} animationType="slide" visible={isModalVisible}>
                    <View style={styles.modalContainer}>
                        <View style={styles.popup}>
                            <Text style={styles.popupTitle}>{selectedMarker.title}</Text>
                            <Text style={styles.popupDescription}>{selectedMarker.description}</Text>
                            <TouchableOpacity
                                style={styles.closeButton}
                                onPress={() => setModalVisible(false)}
                            >
                                <Text style={styles.closeButtonText}>ปิด</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </Modal>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    map: {
        flex: 1,
    },
    markerContainer: {
        alignItems: "center",
        justifyContent: "center",
    },
    busMarkerContainer: {
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "rgba(255, 255, 255, 0.8)",
        borderRadius: 15,
        padding: 5,
    },
    modalContainer: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: "rgba(0, 0, 0, 0.6)",
    },
    popup: {
        width: "80%",
        backgroundColor: "#fff",
        padding: 20,
        borderRadius: 15,
        alignItems: "center",
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.5,
        shadowRadius: 10,
        elevation: 5,
    },
    popupTitle: {
        fontSize: 20,
        fontWeight: "bold",
        color: "#4A4A4A",
        marginBottom: 10,
    },
    popupDescription: {
        fontSize: 16,
        color: "#7A7A7A",
        textAlign: "center",
        marginBottom: 15,
    },
    closeButton: {
        marginTop: 10,
        backgroundColor: "#6200EA",
        padding: 12,
        borderRadius: 25,
        width: "50%",
        alignItems: "center",
        justifyContent: "center",
    },
    closeButtonText: {
        color: "white",
        fontSize: 16,
        fontWeight: "bold",
    },
    loadingContainer: {
        ...StyleSheet.absoluteFillObject,
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: "rgba(255, 255, 255, 0.8)",
    },
    closeIcon: {
        position: "absolute",
        top: 15,
        right: 15,
        backgroundColor: "white",
        borderRadius: 20,
        width: 40,
        height: 40,
        justifyContent: "center",
        alignItems: "center",
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
        elevation: 5,
        zIndex: 10,
    },
    closeIconContainer: {
        width: 40,
        height: 40,
        borderRadius: 10,
        alignItems: "center",
        justifyContent: "center",
    },
});

export default App;