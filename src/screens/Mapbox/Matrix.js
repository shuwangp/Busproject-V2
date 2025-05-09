export const fetchMatrixData = async (userLocation, busLocation, setDistanceToBus, setETA, tokenmapbox) => {
    if (!userLocation || !busLocation) {
        console.log("❌ fetchMatrixData ไม่ทำงาน เพราะไม่มี userLocation หรือ busLocation");
        return;
    }

    const coordinates = `${userLocation.longitude},${userLocation.latitude};${busLocation.longitude},${busLocation.latitude}`;
    const matrixURL = `https://api.mapbox.com/directions-matrix/v1/mapbox/driving/${coordinates}?annotations=distance,duration&access_token=${tokenmapbox}`;

    try {
        const response = await fetch(matrixURL);
        const data = await response.json();

        console.log("✅ Response จาก Matrix API:", data);

        if (data.distances && data.distances[0] && data.distances[0][1]) {
            const distance = data.distances[0][1]; 
            setDistanceToBus(distance);
            console.log(`🚍 ระยะห่างจากรถเมล์: ${distance} เมตร`);
        }

        if (data.durations && data.durations[0] && data.durations[0][1]) {
            const durationInSeconds = data.durations[0][1]; // เวลาในหน่วยวินาที
            const durationInMinutes = Math.ceil(durationInSeconds / 60); // แปลงเป็นนาที
            setETA(durationInMinutes);
            console.log(`⏳ เวลาที่รถเมล์จะมาถึง: ${durationInMinutes} นาที`);
        }
    } catch (error) {
        console.error("❌ Error fetching Matrix data:", error);
    }
};
