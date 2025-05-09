import React from "react";
import { Dimensions } from "react-native";
import { PieChart } from "react-native-chart-kit";

const screenWidth = Dimensions.get("window").width;

const COLORS = ["#0088FE", "#00C49F", "#FFBB28", "#FF8042", "#AF19FF", "#FF5733", "#33FF57"];

const PieChartComponent = ({ data }) => {
  const chartData = data.map((entry, index) => ({
    name: entry.name,
    population: entry.value,
    color: COLORS[index % COLORS.length],
    legendFontColor: "#7F7F7F",
    legendFontSize: 12
  }));

  return (
    <PieChart
      data={chartData}
      width={screenWidth - 40}
      height={220}
      chartConfig={{
        color: () => `rgba(0, 0, 0, 1)`,
      }}
      accessor={"population"}
      backgroundColor={"transparent"}
      paddingLeft={"20"}
      absolute
    />
  );
};

export default PieChartComponent;
