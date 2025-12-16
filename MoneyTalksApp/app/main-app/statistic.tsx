import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { useCallback, useEffect, useState } from "react";
import {
    ActivityIndicator,
    Dimensions,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import { LineChart } from "react-native-chart-kit";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { Rect, Svg, Text as SvgText } from "react-native-svg";
import { Config } from "../../config";

const screenWidth = Dimensions.get("window").width;

type TopItem = {
    id: number;
    description: string;
    amount: number;
    expense_date: string;
    created_at: string;
    updated_at: string;
};

type SummaryData = {
    income: number;
    expense: number;
    topIncomes: TopItem[];
    topExpenses: TopItem[];
};

type ChartData = {
    lineData: {
        labels: string[];
        datasets: any[];
        legend?: string[];
    };
    totalIncome: number;
    totalExpense: number;
    unit: "k" | "tr";
};

type SummaryRange = "today" | "7d" | "30d" | "1y";
type LongTermRange = "7d" | "30d" | "1y";

const initialSummaryData: SummaryData = {
    income: 0,
    expense: 0,
    topIncomes: [],
    topExpenses: [],
};

const initialChartData: ChartData = {
    lineData: {
        labels: [],
        datasets: [],
        legend: ["Thu (k)", "Chi (k)"],
    },
    totalIncome: 0,
    totalExpense: 0,
    unit: "k",
};

export default function StatisticScreen() {
    const [summaryData, setSummaryData] =
        useState<SummaryData>(initialSummaryData);
    const [summaryRange, setSummaryRange] = useState<SummaryRange>("today");
    const [loadingSummary, setLoadingSummary] = useState(false);
    const [summaryError, setSummaryError] = useState<string | null>(null);
    const [expandedIncomeIndex, setExpandedIncomeIndex] = useState<
        number | null
    >(null);
    const [expandedExpenseIndex, setExpandedExpenseIndex] = useState<
        number | null
    >(null);

    const [longTermRange, setLongTermRange] = useState<LongTermRange>("7d");
    const [chartData, setChartData] = useState<ChartData>(initialChartData);
    const [loadingChart, setLoadingChart] = useState(false);
    const [chartError, setChartError] = useState<string | null>(null);

    const [tooltipPos, setTooltipPos] = useState({
        x: 0,
        y: 0,
        visible: false,
        value: 0,
        datasetIndex: 0,
    });

    const fetchSummaryData = useCallback(async () => {
        setLoadingSummary(true);
        setSummaryError(null);
        setExpandedIncomeIndex(null);
        setExpandedExpenseIndex(null);

        try {
            const token = await AsyncStorage.getItem("token");
            const response = await fetch(
                `${Config.API_BASE_URL}/api/v1/user/statistics/summary?range=${summaryRange}&top=10`,
                {
                    headers: {
                        Authorization: `Bearer ${token}`,
                    },
                }
            );

            const data = await response.json();

            if (!response.ok) {
                throw new Error(
                    data.error || "Không thể tải dữ liệu tổng quan"
                );
            }

            setSummaryData({
                income: data.total_income,
                expense: data.total_expense,
                topIncomes: data.top_incomes,
                topExpenses: data.top_expenses,
            });
        } catch (e: any) {
            setSummaryError(e.message);
        } finally {
            setLoadingSummary(false);
        }
    }, [summaryRange]);

    const fetchChartData = useCallback(async () => {
        setLoadingChart(true);
        setChartError(null);

        try {
            const token = await AsyncStorage.getItem("token");
            if (!token) throw new Error("Chưa đăng nhập");

            const response = await fetch(
                `${Config.API_BASE_URL}/api/v1/user/statistics/chart?range=${longTermRange}`,
                {
                    headers: {
                        Authorization: `Bearer ${token}`,
                    },
                }
            );

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || "Không thể tải dữ liệu biểu đồ");
            }

            const incomeColor = (opacity = 1) =>
                `rgba(40, 167, 69, ${opacity})`;
            const expenseColor = (opacity = 1) =>
                `rgba(220, 53, 69, ${opacity})`;

            const transformedDatasets = data.lineData.datasets.map(
                (ds: any) => ({
                    data: ds.data,
                    color: ds.type === "income" ? incomeColor : expenseColor,
                    strokeWidth: 2,
                })
            );

            const legendUnit = data.unit === "tr" ? "tr" : "k";
            const transformedLegend = [
                `Thu (${legendUnit})`,
                `Chi (${legendUnit})`,
            ];

            setChartData({
                lineData: {
                    labels: data.lineData.labels,
                    datasets: transformedDatasets,
                    legend: transformedLegend,
                },
                totalIncome: data.total_income,
                totalExpense: data.total_expense,
                unit: data.unit,
            });
        } catch (e: any) {
            setChartError(e.message);
        } finally {
            setLoadingChart(false);
        }
    }, [longTermRange]);

    useEffect(() => {
        fetchSummaryData();
    }, [fetchSummaryData]);

    useEffect(() => {
        fetchChartData();
    }, [fetchChartData]);

    const formatAmount = (amount: number, short = false) => {
        if (short) {
            if (Math.abs(amount) >= 1000000) {
                return (
                    (amount / 1000000).toLocaleString("vi-VN", {
                        maximumFractionDigits: 1,
                    }) + "tr ₫"
                );
            } else if (Math.abs(amount) >= 1000) {
                return (
                    (amount / 1000).toLocaleString("vi-VN", {
                        maximumFractionDigits: 1,
                    }) + "k ₫"
                );
            } else {
                return amount.toLocaleString("vi-VN", {
                    style: "currency",
                    currency: "VND",
                });
            }
        }

        return amount.toLocaleString("vi-VN", {
            style: "currency",
            currency: "VND",
        });
    };

    const formatDetailedTimestamp = (isoString: string) => {
        try {
            const date = new Date(isoString);
            return date.toLocaleString("vi-VN", {
                day: "2-digit",
                month: "2-digit",
                year: "numeric",
            });
        } catch (e) {
            return "N/A";
        }
    };

    const chartConfig = {
        backgroundColor: "#ffffff",
        backgroundGradientFrom: "#ffffff",
        backgroundGradientTo: "#ffffff",
        decimalPlaces: 0,
        color: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
        labelColor: (opacity = 1) => `rgba(100, 100, 100, ${opacity})`,
        style: {
            borderRadius: 16,
        },
        propsForDots: {
            r: "4",
            strokeWidth: "1",
            stroke: "#ccc",
        },
    };

    const renderTooltip = () => {
        if (!tooltipPos.visible) return null;

        const unit = chartData.unit === "tr" ? " tr" : " k";

        const legend = chartData.lineData.legend
            ? chartData.lineData.legend[tooltipPos.datasetIndex]
            : "";
        const displayValue = `${tooltipPos.value}${unit}`;

        const tooltipText = legend
            ? `${legend}: ${displayValue}`
            : displayValue;

        return (
            <Svg>
                <Rect
                    x={tooltipPos.x - 40}
                    y={tooltipPos.y - 30}
                    width={tooltipText.length * 7 + 10}
                    height={25}
                    rx={5}
                    ry={5}
                    fill="rgba(0, 0, 0, 0.7)"
                />
                <SvgText
                    x={tooltipPos.x - 35}
                    y={tooltipPos.y - 13}
                    fill="white"
                    fontSize="12"
                    fontWeight="bold"
                    textAnchor="start"
                >
                    {tooltipText}
                </SvgText>
            </Svg>
        );
    };

    return (
        <SafeAreaProvider>
            <SafeAreaView style={styles.safeArea}>
                <ScrollView
                    style={styles.container}
                    contentContainerStyle={styles.scrollContent}
                >
                    <Text style={styles.sectionTitle}>Tổng quan</Text>
                    <View style={styles.rangeSelector}>
                        <TouchableOpacity
                            style={[
                                styles.rangeButton,
                                summaryRange === "today" &&
                                    styles.rangeButtonActive,
                            ]}
                            onPress={() => setSummaryRange("today")}
                        >
                            <Text
                                style={[
                                    styles.rangeButtonText,
                                    summaryRange === "today" &&
                                        styles.rangeButtonTextActive,
                                ]}
                            >
                                Hôm nay
                            </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[
                                styles.rangeButton,
                                summaryRange === "7d" &&
                                    styles.rangeButtonActive,
                            ]}
                            onPress={() => setSummaryRange("7d")}
                        >
                            <Text
                                style={[
                                    styles.rangeButtonText,
                                    summaryRange === "7d" &&
                                        styles.rangeButtonTextActive,
                                ]}
                            >
                                7 ngày
                            </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[
                                styles.rangeButton,
                                summaryRange === "30d" &&
                                    styles.rangeButtonActive,
                            ]}
                            onPress={() => setSummaryRange("30d")}
                        >
                            <Text
                                style={[
                                    styles.rangeButtonText,
                                    summaryRange === "30d" &&
                                        styles.rangeButtonTextActive,
                                ]}
                            >
                                30 ngày
                            </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[
                                styles.rangeButton,
                                summaryRange === "1y" &&
                                    styles.rangeButtonActive,
                            ]}
                            onPress={() => setSummaryRange("1y")}
                        >
                            <Text
                                style={[
                                    styles.rangeButtonText,
                                    summaryRange === "1y" &&
                                        styles.rangeButtonTextActive,
                                ]}
                            >
                                1 năm
                            </Text>
                        </TouchableOpacity>
                    </View>

                    {loadingSummary ? (
                        <ActivityIndicator
                            size="large"
                            color="#168118"
                            style={styles.loadingIndicator}
                        />
                    ) : summaryError ? (
                        <Text style={styles.errorText}>{summaryError}</Text>
                    ) : (
                        <View style={styles.todaySection}>
                            <View style={styles.summaryContainer}>
                                <View
                                    style={[
                                        styles.summaryCard,
                                        styles.incomeCard,
                                    ]}
                                >
                                    <Ionicons
                                        name="arrow-up-circle-outline"
                                        size={24}
                                        color="#28a745"
                                    />
                                    <Text style={styles.summaryLabel}>
                                        Tổng thu
                                    </Text>
                                    <Text
                                        style={[
                                            styles.summaryAmount,
                                            styles.incomeText,
                                        ]}
                                    >
                                        {formatAmount(summaryData.income, true)}
                                    </Text>
                                </View>
                                <View
                                    style={[
                                        styles.summaryCard,
                                        styles.expenseCard,
                                    ]}
                                >
                                    <Ionicons
                                        name="arrow-down-circle-outline"
                                        size={24}
                                        color="#dc3545ff"
                                    />
                                    <Text style={styles.summaryLabel}>
                                        Tổng chi
                                    </Text>
                                    <Text
                                        style={[
                                            styles.summaryAmount,
                                            styles.expenseText,
                                        ]}
                                    >
                                        {formatAmount(
                                            summaryData.expense,
                                            true
                                        )}
                                    </Text>
                                </View>
                            </View>

                            <View>
                                <View style={styles.topList}>
                                    <Text style={styles.topListTitle}>
                                        <Ionicons
                                            name="trending-up-outline"
                                            size={16}
                                            color="#28a745"
                                        />
                                        Top 10 Khoản Thu
                                    </Text>
                                    {summaryData.topIncomes.length > 0 ? (
                                        summaryData.topIncomes.map(
                                            (item, index) => {
                                                const isExpanded =
                                                    expandedIncomeIndex ===
                                                    index;
                                                return (
                                                    <View key={item.id}>
                                                        <TouchableOpacity
                                                            style={
                                                                styles.topItem
                                                            }
                                                            onPress={() =>
                                                                setExpandedIncomeIndex(
                                                                    isExpanded
                                                                        ? null
                                                                        : index
                                                                )
                                                            }
                                                        >
                                                            <Text
                                                                style={
                                                                    styles.topItemIndex
                                                                }
                                                            >
                                                                {index + 1}.
                                                            </Text>
                                                            <Text
                                                                style={
                                                                    styles.topItemDesc
                                                                }
                                                                numberOfLines={
                                                                    1
                                                                }
                                                            >
                                                                {
                                                                    item.description
                                                                }
                                                            </Text>
                                                            <Text
                                                                style={[
                                                                    styles.topItemAmount,
                                                                    styles.incomeText,
                                                                ]}
                                                            >
                                                                {formatAmount(
                                                                    item.amount
                                                                )}
                                                            </Text>
                                                            <Ionicons
                                                                name={
                                                                    isExpanded
                                                                        ? "chevron-up-outline"
                                                                        : "chevron-down-outline"
                                                                }
                                                                size={18}
                                                                color="#adb5bd"
                                                            />
                                                        </TouchableOpacity>
                                                        {/* ... Chi tiết item ... */}
                                                        {isExpanded && (
                                                            <View
                                                                style={
                                                                    styles.topItemDetails
                                                                }
                                                            >
                                                                {/* ... (Các trường chi tiết không đổi) ... */}
                                                                <View
                                                                    style={
                                                                        styles.detailRow
                                                                    }
                                                                >
                                                                    <Text
                                                                        style={
                                                                            styles.detailLabel
                                                                        }
                                                                    >
                                                                        ID:
                                                                    </Text>
                                                                    <Text
                                                                        style={
                                                                            styles.detailValue
                                                                        }
                                                                    >
                                                                        {
                                                                            item.id
                                                                        }
                                                                    </Text>
                                                                </View>
                                                                <View
                                                                    style={
                                                                        styles.detailRow
                                                                    }
                                                                >
                                                                    <Text
                                                                        style={
                                                                            styles.detailLabel
                                                                        }
                                                                    >
                                                                        Mô tả:
                                                                    </Text>
                                                                    <Text
                                                                        style={[
                                                                            styles.detailValue,
                                                                            styles.detailValueDesc,
                                                                        ]}
                                                                    >
                                                                        {
                                                                            item.description
                                                                        }
                                                                    </Text>
                                                                </View>
                                                                <View
                                                                    style={
                                                                        styles.detailRow
                                                                    }
                                                                >
                                                                    <Text
                                                                        style={
                                                                            styles.detailLabel
                                                                        }
                                                                    >
                                                                        Số tiền:
                                                                    </Text>
                                                                    <Text
                                                                        style={[
                                                                            styles.detailValue,
                                                                            styles.incomeText,
                                                                        ]}
                                                                    >
                                                                        {formatAmount(
                                                                            item.amount
                                                                        )}
                                                                    </Text>
                                                                </View>
                                                                <View
                                                                    style={
                                                                        styles.detailRow
                                                                    }
                                                                >
                                                                    <Text
                                                                        style={
                                                                            styles.detailLabel
                                                                        }
                                                                    >
                                                                        Ngày thu
                                                                        chi:
                                                                    </Text>
                                                                    <Text
                                                                        style={
                                                                            styles.detailValue
                                                                        }
                                                                    >
                                                                        {formatDetailedTimestamp(
                                                                            item.expense_date
                                                                        )}
                                                                    </Text>
                                                                </View>
                                                            </View>
                                                        )}
                                                    </View>
                                                );
                                            }
                                        )
                                    ) : (
                                        <Text style={styles.noDataText}>
                                            Chưa có khoản thu nào.
                                        </Text>
                                    )}
                                </View>

                                <View style={styles.topList}>
                                    <Text style={styles.topListTitle}>
                                        <Ionicons
                                            name="trending-down-outline"
                                            size={16}
                                            color="#dc3545"
                                        />
                                        Top 10 Khoản Chi
                                    </Text>
                                    {summaryData.topExpenses.length > 0 ? (
                                        summaryData.topExpenses.map(
                                            (item, index) => {
                                                const isExpanded =
                                                    expandedExpenseIndex ===
                                                    index;
                                                return (
                                                    <View key={item.id}>
                                                        {/* ... item ... */}
                                                        <TouchableOpacity
                                                            style={
                                                                styles.topItem
                                                            }
                                                            onPress={() =>
                                                                setExpandedExpenseIndex(
                                                                    isExpanded
                                                                        ? null
                                                                        : index
                                                                )
                                                            }
                                                        >
                                                            <Text
                                                                style={
                                                                    styles.topItemIndex
                                                                }
                                                            >
                                                                {index + 1}.
                                                            </Text>
                                                            <Text
                                                                style={
                                                                    styles.topItemDesc
                                                                }
                                                                numberOfLines={
                                                                    1
                                                                }
                                                            >
                                                                {
                                                                    item.description
                                                                }
                                                            </Text>
                                                            <Text
                                                                style={[
                                                                    styles.topItemAmount,
                                                                    styles.expenseText,
                                                                ]}
                                                            >
                                                                {formatAmount(
                                                                    item.amount
                                                                )}
                                                            </Text>
                                                            <Ionicons
                                                                name={
                                                                    isExpanded
                                                                        ? "chevron-up-outline"
                                                                        : "chevron-down-outline"
                                                                }
                                                                size={18}
                                                                color="#adb5bd"
                                                            />
                                                        </TouchableOpacity>
                                                        {/* ... Chi tiết item ... */}
                                                        {isExpanded && (
                                                            <View
                                                                style={
                                                                    styles.topItemDetails
                                                                }
                                                            >
                                                                {/* ... (Các trường chi tiết không đổi) ... */}
                                                                <View
                                                                    style={
                                                                        styles.detailRow
                                                                    }
                                                                >
                                                                    <Text
                                                                        style={
                                                                            styles.detailLabel
                                                                        }
                                                                    >
                                                                        ID:
                                                                    </Text>
                                                                    <Text
                                                                        style={
                                                                            styles.detailValue
                                                                        }
                                                                    >
                                                                        {
                                                                            item.id
                                                                        }
                                                                    </Text>
                                                                </View>
                                                                <View
                                                                    style={
                                                                        styles.detailRow
                                                                    }
                                                                >
                                                                    <Text
                                                                        style={
                                                                            styles.detailLabel
                                                                        }
                                                                    >
                                                                        Mô tả:
                                                                    </Text>
                                                                    <Text
                                                                        style={[
                                                                            styles.detailValue,
                                                                            styles.detailValueDesc,
                                                                        ]}
                                                                    >
                                                                        {
                                                                            item.description
                                                                        }
                                                                    </Text>
                                                                </View>
                                                                <View
                                                                    style={
                                                                        styles.detailRow
                                                                    }
                                                                >
                                                                    <Text
                                                                        style={
                                                                            styles.detailLabel
                                                                        }
                                                                    >
                                                                        Số tiền:
                                                                    </Text>
                                                                    <Text
                                                                        style={[
                                                                            styles.detailValue,
                                                                            styles.expenseText,
                                                                        ]}
                                                                    >
                                                                        {formatAmount(
                                                                            item.amount
                                                                        )}
                                                                    </Text>
                                                                </View>
                                                                <View
                                                                    style={
                                                                        styles.detailRow
                                                                    }
                                                                >
                                                                    <Text
                                                                        style={
                                                                            styles.detailLabel
                                                                        }
                                                                    >
                                                                        Ngày thu
                                                                        chi:
                                                                    </Text>
                                                                    <Text
                                                                        style={
                                                                            styles.detailValue
                                                                        }
                                                                    >
                                                                        {formatDetailedTimestamp(
                                                                            item.expense_date
                                                                        )}
                                                                    </Text>
                                                                </View>
                                                                <View
                                                                    style={
                                                                        styles.detailRow
                                                                    }
                                                                >
                                                                    <Text
                                                                        style={
                                                                            styles.detailLabel
                                                                        }
                                                                    >
                                                                        Ngày
                                                                        tạo:
                                                                    </Text>
                                                                    <Text
                                                                        style={
                                                                            styles.detailValue
                                                                        }
                                                                    >
                                                                        {formatDetailedTimestamp(
                                                                            item.created_at
                                                                        )}
                                                                    </Text>
                                                                </View>
                                                            </View>
                                                        )}
                                                    </View>
                                                );
                                            }
                                        )
                                    ) : (
                                        <Text style={styles.noDataText}>
                                            Chưa có khoản chi nào.
                                        </Text>
                                    )}
                                </View>
                            </View>
                        </View>
                    )}

                    <Text style={styles.sectionTitle}>Biểu đồ thu chi</Text>
                    <View>
                        <View style={styles.rangeSelector}>
                            <TouchableOpacity
                                style={[
                                    styles.rangeButton,
                                    longTermRange === "7d" &&
                                        styles.rangeButtonActive,
                                ]}
                                onPress={() => setLongTermRange("7d")}
                            >
                                <Text
                                    style={[
                                        styles.rangeButtonText,
                                        longTermRange === "7d" &&
                                            styles.rangeButtonTextActive,
                                    ]}
                                >
                                    7 ngày
                                </Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[
                                    styles.rangeButton,
                                    longTermRange === "30d" &&
                                        styles.rangeButtonActive,
                                ]}
                                onPress={() => setLongTermRange("30d")}
                            >
                                <Text
                                    style={[
                                        styles.rangeButtonText,
                                        longTermRange === "30d" &&
                                            styles.rangeButtonTextActive,
                                    ]}
                                >
                                    30 ngày
                                </Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[
                                    styles.rangeButton,
                                    longTermRange === "1y" &&
                                        styles.rangeButtonActive,
                                ]}
                                onPress={() => setLongTermRange("1y")}
                            >
                                <Text
                                    style={[
                                        styles.rangeButtonText,
                                        longTermRange === "1y" &&
                                            styles.rangeButtonTextActive,
                                    ]}
                                >
                                    1 năm
                                </Text>
                            </TouchableOpacity>
                        </View>

                        {loadingChart ? (
                            <ActivityIndicator
                                style={styles.loadingIndicator}
                                size="large"
                                color="#168118"
                            />
                        ) : chartError ? (
                            <Text style={styles.errorText}>{chartError}</Text>
                        ) : (
                            <>
                                <Text style={styles.chartTitle}>
                                    Biểu đồ biến động
                                </Text>
                                {chartData.lineData.datasets.length > 0 &&
                                chartData.lineData.labels.length > 0 ? (
                                    <LineChart
                                        data={chartData.lineData}
                                        width={screenWidth - 32}
                                        height={240}
                                        chartConfig={chartConfig}
                                        bezier
                                        style={styles.chartStyle}
                                        yAxisSuffix={
                                            chartData.unit === "tr"
                                                ? " tr"
                                                : " k"
                                        }
                                        decorator={renderTooltip}
                                        onDataPointClick={(data) => {
                                            const datasetIndex =
                                                chartData.lineData.datasets.findIndex(
                                                    (ds) =>
                                                        ds.data ===
                                                        data.dataset.data
                                                );
                                            setTooltipPos({
                                                x: data.x,
                                                y: data.y,
                                                visible: true,
                                                value: data.value,
                                                datasetIndex: datasetIndex,
                                            });
                                        }}
                                        segments={5}
                                        yLabelsOffset={5}
                                        xLabelsOffset={-5}
                                    />
                                ) : (
                                    <Text style={styles.noDataText}>
                                        Không có dữ liệu biểu đồ.
                                    </Text>
                                )}

                                <View style={styles.chartTotalContainer}>
                                    <View style={styles.chartTotalItem}>
                                        <Ionicons
                                            name="arrow-up-circle-outline"
                                            size={24}
                                            color="#28a745"
                                        />
                                        <Text
                                            style={[
                                                styles.summaryAmount,
                                                styles.incomeText,
                                                styles.chartTotalText,
                                            ]}
                                        >
                                            {formatAmount(
                                                chartData.totalIncome,
                                                true
                                            )}
                                        </Text>
                                    </View>
                                    <View style={styles.chartTotalItem}>
                                        <Ionicons
                                            name="arrow-down-circle-outline"
                                            size={24}
                                            color="#dc3545ff"
                                        />
                                        <Text
                                            style={[
                                                styles.summaryAmount,
                                                styles.expenseText,
                                                styles.chartTotalText,
                                            ]}
                                        >
                                            {formatAmount(
                                                chartData.totalExpense,
                                                true
                                            )}
                                        </Text>
                                    </View>
                                </View>
                                {/* ĐẾN ĐÂY */}
                            </>
                        )}
                    </View>
                </ScrollView>
            </SafeAreaView>
        </SafeAreaProvider>
    );
}

const { width } = Dimensions.get("window");
const isSmallScreen = width < 400;
const fontAdjustment = isSmallScreen ? -2 : 0;
const spacingAdjustment = isSmallScreen ? -2 : 0;

const styles = StyleSheet.create({
    safeArea: {
        flex: 1,
        backgroundColor: "#f8f9fa",
    },
    container: {
        flex: 1,
    },
    scrollContent: {
        padding: 16 + spacingAdjustment,
        paddingBottom: 40 + spacingAdjustment,
    },
    sectionTitle: {
        fontSize: 22 + fontAdjustment,
        fontWeight: "bold",
        color: "#343a40",
        marginBottom: 15 + spacingAdjustment,
        marginTop: 10 + spacingAdjustment,
    },
    loadingIndicator: {
        marginTop: 30 + spacingAdjustment,
        marginBottom: 20 + spacingAdjustment,
        height: 100,
        justifyContent: "center",
        alignItems: "center",
    },
    errorText: {
        fontSize: 16 + fontAdjustment,
        color: "#dc3545",
        textAlign: "center",
        marginVertical: 20 + spacingAdjustment,
        padding: 15 + spacingAdjustment,
        backgroundColor: "#f8d7da",
        borderRadius: 10,
        borderWidth: 1,
        borderColor: "#f5c6cb",
    },
    todaySection: {
        marginBottom: 25 + spacingAdjustment,
    },
    summaryContainer: {
        flexDirection: "row",
        justifyContent: "space-between",
        marginBottom: 25 + spacingAdjustment,
    },
    summaryCard: {
        flex: 1,
        backgroundColor: "#fff",
        borderRadius: 12,
        paddingVertical: 18 + spacingAdjustment,
        paddingHorizontal: 15 + spacingAdjustment,
        justifyContent: "center",
        alignItems: "center",
        marginHorizontal: Math.max(2, 6 + spacingAdjustment),
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 4,
    },
    incomeCard: {
        borderColor: "#28a745",
        borderLeftWidth: 5,
    },
    expenseCard: {
        borderColor: "#dc3545",
        borderLeftWidth: 5,
    },
    summaryLabel: {
        fontSize: 15 + fontAdjustment,
        color: "#6c757d",
        marginTop: 8 + spacingAdjustment,
        marginBottom: 4 + spacingAdjustment,
    },
    summaryAmount: {
        fontSize: 20 + fontAdjustment,
        fontWeight: "bold",
    },
    incomeText: {
        color: "#28a745",
    },
    expenseText: {
        color: "#dc3545",
    },
    topList: {
        backgroundColor: "#fff",
        borderRadius: 12,
        padding: 15 + spacingAdjustment,
        marginBottom: 18 + spacingAdjustment,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.08,
        shadowRadius: 3,
        elevation: 3,
    },
    topListTitle: {
        fontSize: 17 + fontAdjustment,
        fontWeight: "600",
        color: "#495057",
        marginBottom: 12 + spacingAdjustment,
        borderBottomWidth: 1,
        borderBottomColor: "#dee2e6",
        paddingBottom: 8 + spacingAdjustment,
        flexDirection: "row",
        alignItems: "center",
    },
    topItem: {
        flexDirection: "row",
        alignItems: "center",
        paddingVertical: 10 + spacingAdjustment,
    },
    topItemIndex: {
        width: 25,
        color: "#adb5bd",
        fontSize: 13 + fontAdjustment,
        textAlign: "center",
    },
    topItemDesc: {
        flex: 1,
        fontSize: 15 + fontAdjustment,
        color: "#495057",
        marginRight: 8 + spacingAdjustment,
    },
    topItemAmount: {
        fontSize: 15 + fontAdjustment,
        fontWeight: "500",
        marginRight: 5 + spacingAdjustment,
    },
    noDataText: {
        fontSize: 14 + fontAdjustment,
        color: "#adb5bd",
        textAlign: "center",
        marginTop: 15 + spacingAdjustment,
        fontStyle: "italic",
    },

    topItemDetails: {
        backgroundColor: "#f0f0f0ff",
        borderRadius: 10,
        padding: 15 + spacingAdjustment,
        marginHorizontal: 25 + spacingAdjustment,
        marginBottom: 5 + spacingAdjustment,
    },
    detailRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        paddingVertical: Math.max(1, 4 + spacingAdjustment),
    },
    detailLabel: {
        fontSize: 14 + fontAdjustment,
        color: "#6c757d",
        fontWeight: "500",
    },
    detailValue: {
        fontSize: 14 + fontAdjustment,
        color: "#343a40",
        fontWeight: "500",
        flexShrink: 1,
        textAlign: "right",
        marginLeft: 10 + spacingAdjustment,
    },
    detailValueDesc: {
        textAlign: "left",
        fontStyle: "italic",
    },

    rangeSelector: {
        flexDirection: "row",
        backgroundColor: "#e9ecef",
        borderRadius: 25,
        padding: Math.max(2, 5 + spacingAdjustment),
        marginBottom: 25 + spacingAdjustment,
        justifyContent: "center",
    },
    rangeButton: {
        flex: 1,
        paddingVertical: 10 + spacingAdjustment,
        borderRadius: 20,
        alignItems: "center",
        marginHorizontal: Math.max(1, 3 + spacingAdjustment),
    },
    rangeButtonActive: {
        backgroundColor: "#fff",
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.15,
        shadowRadius: 4,
        elevation: 4,
    },
    rangeButtonText: {
        fontSize: 14 + fontAdjustment,
        color: "#6c757d",
        fontWeight: "500",
    },
    rangeButtonTextActive: {
        color: "#168118",
        fontWeight: "bold",
    },
    chartTitle: {
        fontSize: 18 + fontAdjustment,
        fontWeight: "600",
        color: "#495057",
        textAlign: "center",
        marginBottom: 12 + spacingAdjustment,
    },
    chartStyle: {
        marginVertical: 10 + spacingAdjustment,
        borderRadius: 16,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 3,
        elevation: 3,
    },

    chartTotalContainer: {
        display: "flex",
        flexDirection: "row",
        justifyContent: "space-evenly",
        marginTop: 10 + spacingAdjustment,
    },
    chartTotalItem: {
        display: "flex",
        flexDirection: "row",
        alignItems: "center",
    },
    chartTotalText: {
        fontSize: 16 + fontAdjustment,
        marginLeft: 8 + spacingAdjustment,
    },
});
