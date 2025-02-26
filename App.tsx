import React from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";

// นำเข้าหน้าต่างๆ
import SplashScreen from "./src/screens/SplashScreen";
import HomeScreen from "./src/screens/HomeScreen";
import MapboxScreen from "./src/screens/Mapbox/MapboxScreen";
// import StatisticsScreen from "./src/screens/Statistics";

const Stack = createNativeStackNavigator();

export default function App() {
  return (
    <NavigationContainer>
      <Stack.Navigator initialRouteName="SplashScreen">
        <Stack.Screen name="SplashScreen" component={SplashScreen} options={{ headerShown: false }} />
        <Stack.Screen name="HomeScreen" component={HomeScreen} options={{ headerShown: false }} />
         <Stack.Screen name="MapboxScreen" component={MapboxScreen} options={{ headerShown: false  }} /> 
      </Stack.Navigator>
    </NavigationContainer>
  );
}
