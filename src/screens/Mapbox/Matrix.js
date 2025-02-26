export const fetchMatrixData = async (userLocation, busLocation, setDistanceToBus, tokenmapbox) => {
    if (!userLocation || !busLocation) return;

    const coordinates = `${userLocation.longitude},${userLocation.latitude};${busLocation.longitude},${busLocation.latitude}`;
    const matrixURL = `https://api.mapbox.com/directions-matrix/v1/mapbox/driving/${coordinates}?annotations=distance,duration&access_token=${tokenmapbox}`;

    try {
        const response = await fetch(matrixURL);
        const data = await response.json();

        if (data.distances && data.distances[0] && data.distances[0][1]) {
            const distance = data.distances[0][1]; // 📌 ดึงค่าระยะทาง (เมตร)
            setDistanceToBus(distance);
            console.log(` ระยะห่างจากรถเมล์: ${distance} เมตร`);
        }
    } catch (error) {
        console.error("Error fetching Matrix data:", error);
    }
};





































































// import React, { useEffect, useState } from "react";
// import { StyleSheet, View, Text, Modal, TouchableOpacity } from "react-native";
// import MapboxGL from "@rnmapbox/maps";
// import Directions from "@mapbox/mapbox-sdk/services/directions";
// import MaterialCommunityIcons from "react-native-vector-icons/MaterialCommunityIcons";

// const tokenmapbox = "pk.eyJ1IjoicHVuY2gxMSIsImEiOiJjbTV0Y3k1ZjgwdmVqMm1weDA0MDMxMjF5In0.lSC2Xlg6RdF2VoVjAn5lbg";
// MapboxGL.setAccessToken(tokenmapbox);

// const directionsClient = Directions({ accessToken: tokenmapbox });

//  const fetchMatrixData = useCallback(async () => {
//         setIsLoading(true);
//         const coordinates = markerList
//             .map((marker) => `${marker.longitude},${marker.latitude}`)
//             .join(";");
//         const matrixURL = `https://api.mapbox.com/directions-matrix/v1/mapbox/driving/${coordinates}?annotations=distance,duration&access_token=${tokenmapbox}`;
//         try {
//             const response = await fetch(matrixURL);
//             const data = await response.json();
//             setMatrixData(data);
//         } catch (error) {
//             console.error("Error fetching Matrix data:", error);
//         } finally {
//             setIsLoading(false);
//         }
//     }, []);

//     useEffect(() => {
//         if (!locationPermission) return;
//         fetchRoute();
//         fetchMatrixData();
//     }, [locationPermission, fetchRoute, fetchMatrixData]);

//     const handleMarkerPress = (marker) => {
//         setSelectedMarker(marker);
//         setModalVisible(true);
//     };
    
// export default App;
