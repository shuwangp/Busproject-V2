import React, { useEffect, useState, useCallback } from "react";
import { 
  StyleSheet, 
  View, 
  Text, 
  Modal, 
  TouchableOpacity, 
  ActivityIndicator, 
  Animated, 
  Vibration, 
  Platform,
  Dimensions
} from "react-native";
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
import LinearGradient from 'react-native-linear-gradient';

const { width, height } = Dimensions.get('window');

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
  const [translateY] = useState(new Animated.Value(200));
  const [showNotification, setShowNotification] = useState(false);
  const navigation = useNavigation();
  const [MARKER_LIST, setMarkerList] = useState([]);
  const [busIds, setBusIds] = useState([]);
  const [eta, setETA] = useState(null);
  const [etaData, setEtaData] = useState({});
  const [previousBusLocations, setPreviousBusLocations] = useState({});
  const [busSpeeds, setBusSpeeds] = useState({});
  const [fadeAnim] = useState(new Animated.Value(0));
  const [slideAnim] = useState(new Animated.Value(width));
  const [hasMarkersLoaded, setHasMarkersLoaded] = useState(false);

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
      setHasMarkersLoaded(true); // ตั้งค่าสถานะเมื่อโหลดข้อมูลเสร็จ
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
    let newBusSpeeds = {};
    let newPreviousLocations = { ...previousBusLocations };

    const timestamp = Math.floor(Date.now() / 1000);

    MARKER_LIST.forEach((marker) => {
      let closestBus = null;
      let minDistance = Infinity;

      Object.keys(busLocations).forEach((busId) => {
        const bus = busLocations[busId];

        if (bus && bus.latitude && bus.longitude) {
          if (previousBusLocations[busId]) {
            const prevLocation = previousBusLocations[busId];
            const distance = getDistance(
              { latitude: prevLocation.latitude, longitude: prevLocation.longitude },
              { latitude: bus.latitude, longitude: bus.longitude }
            );
            const timeDiff = timestamp - prevLocation.timestamp;

            if (timeDiff > 0) {
              const speedMetersPerSec = distance / timeDiff;
              newBusSpeeds[busId] = speedMetersPerSec * 3.6;
            }
          }

          newPreviousLocations[busId] = { latitude: bus.latitude, longitude: bus.longitude, timestamp };

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

      if (closestBus) {
        const busSpeedKmh = newBusSpeeds[closestBus.id] || 10;
        const busSpeedMetersPerMin = (busSpeedKmh * 1000) / 60;
        newEtaData[marker.id] = Math.ceil(minDistance / busSpeedMetersPerMin);
      }

      const NOTIFICATION_DISTANCE = 1000;
      if (minDistance < NOTIFICATION_DISTANCE && minDistance < minDistanceForPopup) {
        minDistanceForPopup = minDistance;
        closestMarker = marker;
      }
    });

    setPreviousBusLocations(newPreviousLocations);
    setBusSpeeds(newBusSpeeds);
    setEtaData(newEtaData);

    if (closestMarker) {
      setShowNotification(true);
      setSelectedMarker({
        ...closestMarker,
        eta: newEtaData[closestMarker.id],
      });
      setMarkerModalVisible(true);

      Animated.timing(translateY, {
        toValue: 0,
        duration: 1000,
        useNativeDriver: true,
      }).start();

      if (Platform.OS === "android" || Platform.OS === "ios") {
        Vibration.vibrate();
      }
    } else {
      setShowNotification(false);
      setMarkerModalVisible(false);
    }
  }, [busLocations, userLocation, MARKER_LIST, previousBusLocations]);

  // Animate notification bar
  useEffect(() => {
    Animated.timing(translateY, {
      toValue: showNotification ? 0 : 200,
      duration: 500,
      useNativeDriver: true,
    }).start();
  }, [showNotification]);

  // Animate bus icons container
  useEffect(() => {
    Animated.timing(slideAnim, {
      toValue: 0,
      duration: 800,
      delay: 300,
      useNativeDriver: true,
    }).start();
  }, []);

  // Fade in animation for map
  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 1000,
      useNativeDriver: true,
    }).start();
  }, []);

  // Fetch route directions - แก้ไขส่วนนี้
  const fetchRoute = useCallback(async () => {
    if (MARKER_LIST.length < 2) {
      return;
    }

    setIsLoading(true);
    
    try {
      // สร้าง waypoints จาก MARKER_LIST
      const waypoints = MARKER_LIST.map(marker => ({
        coordinates: [marker.longitude, marker.latitude]
      }));

      // เพิ่มจุดเริ่มต้นอีกครั้งเพื่อสร้างเส้นทางวงกลม
      waypoints.push({
        coordinates: [MARKER_LIST[0].longitude, MARKER_LIST[0].latitude]
      });

      const response = await directionsClient
        .getDirections({
          profile: "driving",
          waypoints: waypoints,
          geometries: "geojson",
          overview: "full",
        })
        .send();


      if (response.body.routes && response.body.routes.length > 0) {
        setRouteGeoJSON(response.body.routes[0].geometry);
      } else {
        console.warn('No routes found in response');
      }
    } catch (error) {
      console.error("Error fetching directions:", error);
    } finally {
      setIsLoading(false);
    }
  }, [MARKER_LIST]);

  // เรียก fetchRoute เมื่อ MARKER_LIST พร้อมและมีข้อมูล
  useEffect(() => {
    if (locationPermission && hasMarkersLoaded && MARKER_LIST.length > 0) {
      fetchRoute();
    }
  }, [locationPermission, hasMarkersLoaded, MARKER_LIST, fetchRoute]);

  // Handle marker press
  const handleMarkerPress = (marker) => {
    if (marker) {
      setSelectedMarker({
        title: marker.name,
        description: "จุดขึ้นรถ",
        eta: etaData[marker.id] !== undefined ? `${etaData[marker.id]} นาที` : "กำลังคำนวณ...",
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

  const getBusColor = (personCount) => {
    if (personCount === 0) {
      return "#4CAF50"; // Green - empty
    } else if (personCount >= 1 && personCount <= 19) {
      return "#FFC107"; // Yellow - moderate
    } else if (personCount >= 20 && personCount <= 30) {
      return "#FF9800"; // Orange - crowded
    } else if (personCount >= 31 && personCount <= 45) {
      return "#F44336"; // Red - full
    } else {
      return "#9E9E9E"; // Gray - unknown
    }
  };

  const getBusStatusText = (personCount) => {
    if (personCount === 0) {
      return "ว่าง";
    } else if (personCount >= 1 && personCount <= 19) {
      return "พอมีที่";
    } else if (personCount >= 20 && personCount <= 30) {
      return "ค่อนข้างแน่น";
    } else if (personCount >= 31 && personCount <= 45) {
      return "เต็ม";
    } else {
      return "ไม่ทราบสถานะ";
    }
  };

  return (
    <View style={styles.container}>
      <Animated.View style={[styles.mapContainer, { opacity: fadeAnim }]}>
        <MapboxGL.MapView 
          style={styles.map} 
          styleURL="mapbox://styles/mapbox/outdoors-v12"
          logoEnabled={false}
          attributionEnabled={false}
        >
          <MapboxGL.Camera
            zoomLevel={15}
            centerCoordinate={[99.897171, 19.029877]}
            pitch={10}
            animationMode="flyTo"
            animationDuration={1000}
          />

        {routeGeoJSON && (
            <MapboxGL.ShapeSource id="routeSource" shape={routeGeoJSON}>
              <MapboxGL.LineLayer 
                id="routeLine" 
                style={{
                  lineColor: '#BFA2DB', 
                  lineWidth: 4,
                  lineOpacity: 1,
                  lineCap: 'round',
                    lineJoin: 'round',
                    }} 
              />
            </MapboxGL.ShapeSource>
          )}

        {MARKER_LIST.map((marker) => (
          <MapboxGL.PointAnnotation
            key={marker.id}
            id={`marker-${marker.id}`}
            coordinate={[marker.longitude, marker.latitude]}
            onSelected={() => handleMarkerPress(marker)}
            zIndex={100} // เพิ่ม zIndex เพื่อให้อยู่ด้านบน

          >
            <View style={styles.markerContainer}>
              <LinearGradient
                colors={['#6200EA', '#3700B3']}
                style={styles.markerGradient}
              >
                <MaterialCommunityIcons name="bus-stop" size={16} color="white" />
              </LinearGradient>
              <View style={styles.markerPulse} />
            </View>
          </MapboxGL.PointAnnotation>
        ))}


          {Object.keys(busLocations).map((busId) => {
            const bus = busLocations[busId];
            return bus ? (
              <MapboxGL.PointAnnotation 
                key={busId} 
                id={`bus-${busId}`} 
                coordinate={[bus.longitude, bus.latitude]}
              >
                <Animated.View style={[styles.busContainer, {
                  transform: [{
                    scale: busSpeeds[busId]
                ? Animated.multiply(
                    new Animated.Value(1),
                    Animated.add(
                        0.8,
                        Animated.multiply(
                        0.2,
                        Animated.divide(
                            new Animated.Value(busSpeeds[busId]),
                            new Animated.Value(50)
                        )
                        )
                    )
                    )
                : 1
                  }]
                }]}>
                  <View style={[styles.busIconContainer, { 
                    backgroundColor: getBusColor(bus.personCount),
                    borderColor: getBusColor(bus.personCount)
                  }]}>
                    <MaterialCommunityIcons 
                      name="bus" 
                      size={24} 
                      color="white" 
                    />
                    <Text style={styles.busPassengerCount}>{bus.personCount}</Text>
                  </View>
                  <View style={[styles.busDirection, { 
                    backgroundColor: getBusColor(bus.personCount)
                  }]} />
                </Animated.View>
              </MapboxGL.PointAnnotation>
            ) : null;
          })}

          {userLocation && (
            <MapboxGL.PointAnnotation 
              id="user-location" 
              coordinate={[userLocation.longitude, userLocation.latitude]}
            >
              <View style={styles.userLocationContainer}>
                <View style={styles.userLocationPulse} />
                <LinearGradient
                  colors={['#00BCD4', '#0097A7']}
                  style={styles.userLocationPin}
                >
                  <MaterialCommunityIcons name="account" size={16} color="white" />
                </LinearGradient>
              </View>
            </MapboxGL.PointAnnotation>
          )}
        </MapboxGL.MapView>
      </Animated.View>

      {isLoading && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#6200EA" />
          <Text style={styles.loadingText}>กำลังโหลดข้อมูล...</Text>
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

      <Animated.View 
        style={[styles.busIconsContainer, { 
          transform: [{ translateX: slideAnim }] 
        }]}
      >
        <Text style={styles.busIconsTitle}>รถโดยสาร</Text>
        {Object.keys(busLocations).map((busId, index) => {
          const bus = busLocations[busId];
          return bus ? (
            <TouchableOpacity key={busId} onPress={() => handleBusIconPress(busId)}>

              <View style={styles.busIconHeader}>
                <MaterialCommunityIcons 
                  name="bus" 
                  size={20} 
                  color={getBusColor(bus.personCount)} 
                />
                <Text style={styles.busIdText}>รถหมายคันที่ {index + 1}</Text>
              </View>

              <Text style={styles.busStatusText}>
                สถานะ: {getBusStatusText(bus.personCount)}
              </Text>
              <Text style={styles.busPassengerText}>
                {bus.personCount} / 45 คน
              </Text>
              
              <View style={styles.progressBar}>
                <View style={[
                  styles.progressFill, 
                  { 
                    width: `${Math.min(100, (bus.personCount / 45) * 100)}%`,
                    backgroundColor: getBusColor(bus.personCount)
                  }
                ]} />
              </View>

            </TouchableOpacity>
          ) : null;
        })}

      </Animated.View>

    <Animated.View style={styles.slidePanel}>
      <TouchableOpacity onPress={() => navigation.navigate("HomeScreen")}>
        <View style={styles.slideHandle}>
          <MaterialCommunityIcons name="chevron-left" size={24} color="white" />
        </View>
      </TouchableOpacity>
    </Animated.View>

      <Modal 
        transparent 
        animationType="fade" 
        visible={isBusModalVisible}
        onRequestClose={() => setBusModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <LinearGradient
              colors={['#6200EA', '#3700B3']}
              style={styles.modalHeader}
            >
              <Text style={styles.modalTitle}>ข้อมูลรถโดยสาร</Text>
            </LinearGradient>
            
            {selectedBus && (
            <View style={styles.modalContent}>

              {/* ✅ ใส่ logic ตรงนี้ก่อนใช้งาน busNumber */}
              {(() => {
                const busKeys = Object.keys(busLocations);
                const busNumber = busKeys.indexOf(selectedBus.id) + 1;
                return (
                  <View style={styles.modalRow}>
                    <MaterialCommunityIcons name="bus" size={24} color="#6200EA" />
                    <Text style={styles.modalLabel}>หมายเลขรถ:</Text>
                    <Text style={styles.modalValue}>รถหมายเลข {busNumber}</Text>
                  </View>
                );
              })()}

              {/* ส่วนอื่น ๆ ของ modal */}
              <View style={styles.modalRow}>
                <MaterialCommunityIcons name="account-group" size={24} color="#6200EA" />
                <Text style={styles.modalLabel}>ผู้โดยสาร:</Text>
                <Text style={[
                  styles.modalValue, 
                  { color: getBusColor(selectedBus.personCount) }
                ]}>
                  {selectedBus.personCount} คน ({getBusStatusText(selectedBus.personCount)})
                </Text>
              </View>

                
                <View style={styles.modalRow}>
                  <MaterialCommunityIcons name="map-marker" size={24} color="#6200EA" />
                  <Text style={styles.modalLabel}>ตำแหน่ง:</Text>
                  <Text style={styles.modalValue}>
                    {selectedBus.latitude.toFixed(4)}, {selectedBus.longitude.toFixed(4)}
                  </Text>
                </View>
              </View>
            )}
            
            <TouchableOpacity 
              style={styles.modalCloseButton} 
              onPress={() => setBusModalVisible(false)}
            >
              <Text style={styles.modalCloseButtonText}>ปิด</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal 
        transparent 
        animationType="fade" 
        visible={isMarkerModalVisible}
        onRequestClose={() => setMarkerModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <LinearGradient
              colors={['#6200EA', '#3700B3']}
              style={styles.modalHeader}
            >
              <Text style={styles.modalTitle}>{selectedMarker?.title}</Text>
            </LinearGradient>
            
            <View style={styles.modalContent}>
              <View style={styles.modalRow}>
                <MaterialCommunityIcons name="information" size={24} color="#6200EA" />
                <Text style={styles.modalLabel}>รายละเอียด:</Text>
                <Text style={styles.modalValue}>{selectedMarker?.description}</Text>
              </View>
              
              <View style={styles.modalRow}>
                <MaterialCommunityIcons name="clock" size={24} color="#6200EA" />
                <Text style={styles.modalLabel}>รถจะถึง:</Text>
                <Text style={[styles.modalValue, { color: '#4CAF50' }]}>
                  {selectedMarker?.eta ? `${selectedMarker.eta} นาที` : "กำลังคำนวณ..."}
                </Text>
              </View>
              
              <View style={styles.infoBox}>
                <MaterialCommunityIcons name="alert-circle" size={20} color="#FFC107" />
                <Text style={styles.infoText}>
                  รถจะแจ้งเตือนเมื่ออยู่ใกล้จุดจอดของคุณในระยะ 1 กิโลเมตร
                </Text>
              </View>
            </View>
            
            <TouchableOpacity 
              style={styles.modalCloseButton} 
              onPress={() => setMarkerModalVisible(false)}
            >
              <Text style={styles.modalCloseButtonText}>ปิด</Text>
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
    backgroundColor: '#f5f5f5',
  },
  mapContainer: {
    flex: 1,
    opacity: 0,
  },
  map: {
    flex: 1,
  },
  markerContainer: {
    alignItems: "center",
    justifyContent: "center",
    height: 40,
    width: 40,
  },
  markerGradient: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 11,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
  },
  markerPulse: {
    position: 'absolute',
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#6200EA',
    opacity: 0.4  ,
    zIndex: 1,
  },
  busContainer: {
    alignItems: "center",
    justifyContent: "center",
  },
  busIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    transform: [{ rotate: '45deg' }],
    zIndex: 10,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },
  busDirection: {
    position: 'absolute',
    width: 10,
    height: 10,
    borderRadius: 2,
    bottom: -5,
    transform: [{ rotate: '45deg' }],
    zIndex: 5,
  },
  busPassengerCount: {
    fontSize: 10,
    fontWeight: "bold",
    color: "white",
    transform: [{ rotate: '-45deg' }],
    marginTop: 2,
  },
  userLocationContainer: {
    alignItems: "center",
    justifyContent: "center",
    height: 50,
    width: 50,
  },
  userLocationPin: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
    elevation: 3,
  },
  userLocationPulse: {
    position: 'absolute',
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#00BCD4',
    opacity: 0.3,
    zIndex: 1,
  },
  loadingContainer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.9)",
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#6200EA',
    fontWeight: '500',
  },
  busIconsContainer: {
    position: "absolute",
    top: 80,
    left: 10,
    backgroundColor: "white",
    borderRadius: 12,
    padding: 12,
    width: width * 0.4,
    maxHeight: height * 0.6,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 8,
  },
  busIconsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6200EA',
    marginBottom: 8,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    
  },
  busIcon: {
    marginBottom: 12,
    padding: 10,
    borderRadius: 8,
    backgroundColor: '#fff',
    borderLeftWidth: 4,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  busIconHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  busIdText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#333',
    marginLeft: 6,
  },
  busStatusText: {
    fontSize: 11,
    color: '#666',
    marginBottom: 2,
  },
  busPassengerText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#444',
    marginBottom: 6,
  },
  progressBar: {
    height: 4,
    borderRadius: 2,
    backgroundColor: '#eee',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
  },
  modalContainer: {
    width: width * 0.85,
    backgroundColor: '#fff',
    borderRadius: 16,
    overflow: 'hidden',
  },
  modalHeader: {
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: 'white',
  },
  modalContent: {
    padding: 16,
  },
  modalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  modalLabel: {
    fontSize: 14,
    color: '#666',
    marginLeft: 8,
    marginRight: 4,
    fontWeight: '500',
  },
  modalValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  modalCloseButton: {
    backgroundColor: '#6200EA',
    padding: 12,
    alignItems: 'center',
  },
  modalCloseButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  infoBox: {
    flexDirection: 'row',
    backgroundColor: '#FFF9C4',
    padding: 10,
    borderRadius: 8,
    marginTop: 12,
    alignItems: 'center',
  },
  infoText: {
    fontSize: 12,
    color: '#5D4037',
    marginLeft: 8,
    flex: 1,
  },
});

export default App;
