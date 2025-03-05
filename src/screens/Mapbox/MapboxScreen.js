import React, { useEffect, useState, useCallback } from "react";
import { StyleSheet, View, Text, Modal, TouchableOpacity, ActivityIndicator, Animated, Vibration, Platform } from "react-native";
import MapboxGL from "@rnmapbox/maps";
import Directions from "@mapbox/mapbox-sdk/services/directions";
import MaterialCommunityIcons from "react-native-vector-icons/MaterialCommunityIcons";
import { useNavigation } from "@react-navigation/native";
import { getDistance } from "geolib";
import { getDatabase, ref, onValue, off } from "firebase/database";
import { app } from "./firebaseConfig";
import { getFirestore, collection, onSnapshot } from "firebase/firestore";
import useUserLocation from "../useUserLocation";
import { getBusLocation } from "./Firebase";
import NotificationBar from "../NotificationBar";

const MAPBOX_TOKEN = "pk.eyJ1IjoicHVuY2gxMSIsImEiOiJjbTV0Y3k1ZjgwdmVqMm1weDA0MDMxMjF5In0.lSC2Xlg6RdF2VoVjAn5lbg";
MapboxGL.setAccessToken(MAPBOX_TOKEN);

const directionsClient = Directions({ accessToken: MAPBOX_TOKEN });

const App = () => {
    const { userLocation, error } = useUserLocation();
    const [routeGeoJSON, setRouteGeoJSON] = useState(null);
    const [isMarkerModalVisible, setMarkerModalVisible] = useState(false);
    const [isBusModalVisible, setBusModalVisible] = useState(false);
    const [selectedMarker, setSelectedMarker] = useState(null);
    const [selectedBus, setSelectedBus] = useState(null);
    const [locationPermission, setLocationPermission] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [busLocations, setBusLocations] = useState({});
    const [distanceToBus, setDistanceToBus] = useState(null);
    const [translateY, setTranslateY] = useState(new Animated.Value(200));
    const [showNotification, setShowNotification] = useState(false);
    const navigation = useNavigation();
    const [MARKER_LIST, setMarkerList] = useState([]);
    const [busIds, setBusIds] = useState([]);
    const [eta, setETA] = useState(null);
    const [etaData, setEtaData] = useState({});
    const [previousBusLocations, setPreviousBusLocations] = useState({}); // เก็บตำแหน่งก่อนหน้าของรถบัส

    // Request location permission
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

    // Fetch bus stops from Firestore
    useEffect(() => {
        const db = getFirestore(app);
        const busStopsRef = collection(db, "busStops");

        const unsubscribe = onSnapshot(busStopsRef, (snapshot) => {
            const markers = snapshot.docs.map((doc) => ({
                id: doc.id,
                ...doc.data(),
            }));
            setMarkerList(markers);
        });

        return () => unsubscribe();
    }, []);

    // Fetch bus data from Firebase Realtime Database
    useEffect(() => {
        const db = getDatabase(app);
        const busDataRef = ref(db, "bus_data");

        const unsubscribe = onValue(busDataRef, (snapshot) => {
            const data = snapshot.val();
            if (data) {
                const ids = Object.keys(data);
                setBusIds(ids);
            }
        });

        return () => unsubscribe();
    }, []);

    // Fetch bus locations from Firebase
    useEffect(() => {
    if (busIds.length === 0) return;
    const unsubscribe = getBusLocation(busIds, setBusLocations);
    return () => unsubscribe();
}, [busIds]);

    // Calculate distance to bus and ETA
    useEffect(() => {
        if (!userLocation || Object.keys(busLocations).length === 0) return;
    
        let newEtaData = {};
        let closestMarker = null;
        let minDistanceForPopup = Infinity;
        let newBusSpeeds = {}; // เก็บค่าความเร็วของรถบัส
        let newPreviousLocations = { ...previousBusLocations }; // เก็บตำแหน่งก่อนหน้า
    
        const timestamp = Math.floor(Date.now() / 1000); // ใช้เวลาปัจจุบันจาก Client
    
        MARKER_LIST.forEach((marker) => {
            let closestBus = null;
            let minDistance = Infinity;
    
            // หา Bus ที่อยู่ใกล้ป้ายมากที่สุด
            Object.keys(busLocations).forEach((busId) => {
                const bus = busLocations[busId];
    
                if (bus && bus.latitude && bus.longitude) {
                    // คำนวณความเร็วโดยใช้ตำแหน่งก่อนหน้า
                    if (previousBusLocations[busId]) {
                        const prevLocation = previousBusLocations[busId];
                        const distance = getDistance(
                            { latitude: prevLocation.latitude, longitude: prevLocation.longitude },
                            { latitude: bus.latitude, longitude: bus.longitude }
                        ); // ระยะทางเป็นเมตร
                        const timeDiff = timestamp - prevLocation.timestamp; // เวลาที่ผ่านไปเป็นวินาที
    
                        if (timeDiff > 0) {
                            const speedMetersPerSec = distance / timeDiff; // ความเร็วเป็นเมตร/วินาที
                            newBusSpeeds[busId] = speedMetersPerSec * 3.6; // แปลงเป็น km/h
                        }
                    }
    
                    // อัปเดตตำแหน่งก่อนหน้า
                    newPreviousLocations[busId] = { latitude: bus.latitude, longitude: bus.longitude, timestamp };
    
                    // คำนวณระยะห่างระหว่างป้ายกับรถบัส
                    const distanceToMarker = getDistance(
                        { latitude: marker.latitude, longitude: marker.longitude },
                        { latitude: bus.latitude, longitude: bus.longitude }
                    );
    
                    if (distanceToMarker < minDistance) {
                        minDistance = distanceToMarker;
                        closestBus = bus;
                    }
                }
            });
    
            // คำนวณ ETA ถ้ามีรถบัสที่ใกล้ป้าย
            if (closestBus) {
                const busSpeedKmh = newBusSpeeds[closestBus.id] || 10; // ใช้ค่าเริ่มต้น 10 km/h ถ้ายังไม่มีข้อมูล
                const busSpeedMetersPerMin = (busSpeedKmh * 1000) / 60; // แปลงเป็นเมตรต่อนาที
                newEtaData[marker.id] = Math.ceil(minDistance / busSpeedMetersPerMin); // คำนวณ ETA
            }
    
            // แจ้งเตือนถ้ารถบัสอยู่ใกล้ป้ายในระยะ **1000 เมตร**
            const NOTIFICATION_DISTANCE = 1000; 
            if (minDistance < NOTIFICATION_DISTANCE && minDistance < minDistanceForPopup) {
                minDistanceForPopup = minDistance;
                closestMarker = marker;
            }
        });
    
        // อัปเดต state
        setPreviousBusLocations(newPreviousLocations);
        setBusSpeeds(newBusSpeeds);
        setEtaData(newEtaData);
    
        // จัดการแจ้งเตือน
        if (closestMarker) {
            setShowNotification(true);
            setSelectedMarker({
                ...closestMarker,
                eta: newEtaData[closestMarker.id], // ใส่ ETA เข้าไปด้วย
            });
            setMarkerModalVisible(true);
    
            // แสดง Notification Bar
            Animated.timing(translateY, {
                toValue: 0,
                duration: 500,
                useNativeDriver: true,
            }).start();
    
            // ให้มือถือสั่นเมื่อมีการแจ้งเตือน
            if (Platform.OS === "android" || Platform.OS === "ios") {
                Vibration.vibrate();
            }
        } else {
            setShowNotification(false);
            setMarkerModalVisible(false);
    
            // ซ่อน Notification Bar
            Animated.timing(translateY, {
                toValue: 200,
                duration: 500,
                useNativeDriver: true,
            }).start();
        }
    }, [busLocations, userLocation, MARKER_LIST, previousBusLocations]);
    
    

    // Animate notification bar when showNotification changes
    useEffect(() => {
        Animated.timing(translateY, {
            toValue: showNotification ? 0 : 200,
            duration: 500,
            useNativeDriver: true,
        }).start();
    }, [showNotification]);

    // Fetch route directions
    const fetchRoute = useCallback(async () => {
        setIsLoading(true);
        const waypoints = [
            ...MARKER_LIST.map((marker) => ({
                coordinates: [marker.longitude, marker.latitude],
            })),
            {
                coordinates: [MARKER_LIST[0].longitude, MARKER_LIST[0].latitude],
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
    }, [MARKER_LIST]);

    useEffect(() => {
        if (!locationPermission) return;
        fetchRoute();
    }, [locationPermission, fetchRoute]);

    // Handle marker press
    const handleMarkerPress = (marker) => {
        if (marker) {
            console.log("📌 Marker pressed:", marker);
            setSelectedMarker({
                title: marker.name,
                description: "จุดขึ้นรถ",
                eta: etaData[marker.id], // Add ETA to selectedMarker
            });
            setMarkerModalVisible(true);
        }
    };

    // Handle bus icon press
    const handleBusIconPress = (busId) => {
        const bus = busLocations[busId];
        if (bus) {
            setSelectedBus(bus);
            setBusModalVisible(true);
        }
    };

    return (
        <View style={styles.container}>
            <TouchableOpacity style={styles.closeIcon} onPress={() => navigation.navigate("HomeScreen")}>
                <MaterialCommunityIcons name="close" size={30} color="#000" />
            </TouchableOpacity>

            <MapboxGL.MapView style={styles.map} styleURL="mapbox://styles/mapbox/outdoors-v12">
                <MapboxGL.Camera
                    zoomLevel={15}
                    centerCoordinate={[99.897171, 19.029877]}
                    pitch={10}
                    animationMode="flyTo"
                    animationDuration={1000}
                />

                {MARKER_LIST.map((marker) => (
                    <MapboxGL.PointAnnotation
                        key={marker.id}
                        id={`marker-${marker.id}`}
                        coordinate={[marker.longitude, marker.latitude]}
                        onSelected={() => handleMarkerPress(marker)}
                    >
                        <View style={styles.markerContainer}>
                            <MaterialCommunityIcons name="bus-stop-covered" size={25} color="#000" />
                        </View>
                    </MapboxGL.PointAnnotation>
                ))}

                {Object.keys(busLocations).map((busId) => {
                    const bus = busLocations[busId];
                    return bus ? (
                        <MapboxGL.PointAnnotation key={busId} id={`bus-${busId}`} coordinate={[bus.longitude, bus.latitude]}>
                            <View style={styles.busContainer}>
                                <Text style={styles.busPassengerCount}>{bus.personCount}</Text>
                                <MaterialCommunityIcons name="bus" size={30} color={bus.color ?? "red"} />
                            </View>
                        </MapboxGL.PointAnnotation>
                    ) : null;
                })}

                {userLocation && (
                    <MapboxGL.PointAnnotation id="user-location" coordinate={[userLocation.longitude, userLocation.latitude]}>
                        <View style={styles.userLocationContainer}>
                            <Text style={styles.userLocationText}>คุณอยู่ที่นี่</Text>
                        </View>
                    </MapboxGL.PointAnnotation>
                )}

                {routeGeoJSON && (
                    <MapboxGL.ShapeSource id="routeSource" shape={routeGeoJSON}>
                        <MapboxGL.LineLayer id="routeLine" style={styles.routeLine} />
                    </MapboxGL.ShapeSource>
                )}
            </MapboxGL.MapView>

            {isLoading && (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color="#6200EA" />
                </View>
            )}

            <NotificationBar
                showNotification={showNotification}
                translateY={translateY}
                distanceToBus={distanceToBus}
                personCount={selectedBus?.personCount ?? 0}
                ETA={eta}
                setShowNotification={setShowNotification}
            />

            <View style={styles.busIconsContainer}>
                {Object.keys(busLocations).map((busId) => {
                    const bus = busLocations[busId];
                    return bus ? (
                        <TouchableOpacity key={busId} style={styles.busIcon} onPress={() => handleBusIconPress(busId)}>
                            <MaterialCommunityIcons name="bus" size={30} color={bus.color ?? "red"} />
                            <Text style={styles.busPassengerText}>{bus.personCount} คน</Text>
                        </TouchableOpacity>
                    ) : null;
                })}
            </View>

            <Modal transparent animationType="slide" visible={isBusModalVisible}>
                <View style={styles.modalContainer}>
                    <View style={styles.popup}>
                        <Text style={styles.popupTitle}>ข้อมูลรถบัส</Text>
                        {selectedBus && (
                            <>
                                <Text style={styles.popupDescription}>
                                    ตำแหน่ง: {selectedBus.latitude}, {selectedBus.longitude}
                                </Text>
                                <Text style={styles.popupDescription}>
                                    จำนวนผู้โดยสาร: {selectedBus.personCount}
                                </Text>
                            </>
                        )}
                        <TouchableOpacity style={styles.closeButton} onPress={() => setBusModalVisible(false)}>
                            <Text style={styles.closeButtonText}>ปิด</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            <Modal transparent animationType="slide" visible={isMarkerModalVisible}>
                <View style={styles.modalContainer}>
                    <View style={styles.popup}>
                        <Text style={styles.popupTitle}>{selectedMarker?.title}</Text>
                        <Text style={styles.popupDescription}>{selectedMarker?.description}</Text>
                        <Text style={styles.popupDescription}>
                            รถจะถึงคุณใน: {selectedMarker?.eta ? `${selectedMarker.eta} นาที` : "กำลังคำนวณ..."}
                        </Text>
                        <TouchableOpacity style={styles.closeButton} onPress={() => setMarkerModalVisible(false)}>
                            <Text style={styles.closeButtonText}>ปิด</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
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
    busContainer: {
        alignItems: "center",
        justifyContent: "center",
    },
    busPassengerCount: {
        fontSize: 14,
        fontWeight: "bold",
        color: "black",
    },
    userLocationContainer: {
        backgroundColor: "blue",
        borderRadius: 10,
        padding: 5,
    },
    userLocationText: {
        color: "white",
    },
    routeLine: {
        lineColor: "purple",
        lineWidth: 4,
        lineJoin: "round",
        lineCap: "round",
        lineBlur: 0.5,
    },
    loadingContainer: {
        ...StyleSheet.absoluteFillObject,
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: "rgba(255, 255, 255, 0.8)",
    },
    busIconsContainer: {
        position: "absolute",
        top: 80,
        left: 10,
        backgroundColor: "rgba(255, 255, 255, 0.9)",
        borderRadius: 10,
        padding: 10,
        alignItems: "center",
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
        elevation: 5,
    },
    busIcon: {
        marginBottom: 10,
        alignItems: "center",
    },
    busPassengerText: {
        color: "black",
        fontSize: 14,
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
    },
    closeButtonText: {
        color: "white",
        fontSize: 16,
        fontWeight: "bold",
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
});

export default App;