import { Ionicons } from "@expo/vector-icons";
import React, { useState } from "react";
import { ImageBackground, View, useWindowDimensions } from "react-native";
import { SceneMap, TabBar, TabView } from "react-native-tab-view";
import ChatScreen from "./chat";
import DataScreen from "./datasheet";
import StatisticScreen from "./statistic";

type Route = {
    key: string;
    title: string;
    icon: keyof typeof Ionicons.glyphMap;
};

export default function MainApp() {
    const layout = useWindowDimensions();
    const [index, setIndex] = useState(1);
    const [routes] = useState<Route[]>([
        { key: "data", title: "Dữ liệu", icon: "document-text-outline" },
        { key: "chat", title: "Trò chuyện", icon: "chatbubble-ellipses-outline" },
        { key: "statistic", title: "Thống kê", icon: "stats-chart-outline" },
    ]);

    const renderScene = SceneMap({
        data: DataScreen,
        chat: ChatScreen,
        statistic: StatisticScreen,
    });

    return (
        <ImageBackground
            tintColor={"#ffffffff"}
            source={require("../../assets/images/background2.png")}
            style={{ flex: 1 }}
            resizeMode="repeat"
        >
            <View style={{ flex: 1 }}>
                <TabView
                    navigationState={{ index, routes }}
                    renderScene={renderScene}
                    onIndexChange={setIndex}
                    initialLayout={{ width: layout.width }}
                    swipeEnabled
                    renderTabBar={(props) => (
                        <TabBar
                            {...props}
                            style={{
                                backgroundColor: "#168118",
                                shadowColor: "#bd1717ff",
                                shadowOpacity: 0.15,
                                shadowRadius: 50,
                            }}
                            indicatorStyle={{
                                backgroundColor: "#cc2e07",
                                height: 2,
                                borderRadius: 3,
                            }}
                        />
                    )}
                />
            </View>
        </ImageBackground>
    );
}
