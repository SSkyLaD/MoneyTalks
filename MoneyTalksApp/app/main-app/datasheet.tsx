import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import DateTimePicker, {
    DateTimePickerEvent,
} from "@react-native-community/datetimepicker";
import { GoogleSignin } from "@react-native-google-signin/google-signin";
import { Picker } from "@react-native-picker/picker";
import axios, { isAxiosError } from "axios";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Dimensions,
    FlatList,
    Modal,
    RefreshControl,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import Toast from "react-native-toast-message";
import { Config } from "../../config";

type UserExpense = {
    id: number;
    amount: any;
    description: string;
    expense_date: string;
    created_at: string;
    updated_at: string;
};

type FilterParams = {
    sortField: "expense_date" | "amount";
    sortOrder: "asc" | "desc";
    keyword: string;
    startDate: string;
    endDate: string;
    minAmount: string;
    maxAmount: string;
};

export default function DataScreen() {
    const [expenses, setExpenses] = useState<UserExpense[]>([]);
    const [loading, setLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);

    const [loadingAction, setLoadingAction] = useState(false);

    const [filters, setFilters] = useState<FilterParams>({
        sortField: "expense_date",
        sortOrder: "desc",
        keyword: "",
        startDate: "",
        endDate: "",
        minAmount: "",
        maxAmount: "",
    });
    const [tempFilters, setTempFilters] = useState<FilterParams>(filters);
    const [showStartDatePicker, setShowStartDatePicker] = useState(false);
    const [showEndDatePicker, setShowEndDatePicker] = useState(false);
    const [showEditDatePicker, setShowEditDatePicker] = useState(false);
    const [editModalVisible, setEditModalVisible] = useState(false);
    const [filterModalVisible, setFilterModalVisible] = useState(false);
    const [addModalVisible, setAddModalVisible] = useState(false);
    const [editingExpense, setEditingExpense] = useState<UserExpense | null>(
        null
    );
    const [newExpense, setNewExpense] = useState<{
        description: string;
        amount: any;
        expense_date: string;
    }>({
        description: "",
        amount: "",
        expense_date: "",
    });

    const router = useRouter();

    const showToast = (
        type: "success" | "error",
        title: string,
        message: string
    ) => {
        Toast.show({
            type: type,
            text1: title,
            text2: message,
            position: "top",
            visibilityTime: 3000,
        });
    };

    const logOut = async () => {
        await AsyncStorage.removeItem("token");
        await AsyncStorage.removeItem("user");
        GoogleSignin.signOut();
        router.replace("/login");
    };

    const confirmDelete = (expense: UserExpense) => {
        Alert.alert(
            "Xác nhận xóa",
            `Bạn có chắc chắn muốn xóa khoản thu chi "${
                expense.description
            }" với số tiền ${formatAmount(
                expense.amount
            )} không? Hành động này không thể hoàn tác.`,
            [
                {
                    text: "Hủy",
                    style: "cancel",
                },
                {
                    text: "Xóa",
                    onPress: () => handleDeleteExpense(expense.id),
                },
            ]
        );
    };

    const fetchExpenses = useCallback(
        async (
            page: number,
            filterParams: FilterParams,
            isRefresh: boolean = false
        ) => {
            if (!isRefresh) {
                setLoading(true);
            }
            try {
                const res = await axios.get(
                    `${Config.API_BASE_URL}/api/v1/user/expenses?page=${page}&pageSize=10&startDate=${filterParams.startDate}&endDate=${filterParams.endDate}&minAmount=${filterParams.minAmount}&maxAmount=${filterParams.maxAmount}&keyword=${filterParams.keyword}&sortField=${filterParams.sortField}&sortOrder=${filterParams.sortOrder}`,
                    {
                        headers: {
                            Authorization: `Bearer ${await AsyncStorage.getItem(
                                "token"
                            )}`,
                        },
                    }
                );
                setExpenses(res.data.expenses || []);
                setTotalPages(res.data.total_pages || 1);
                setCurrentPage(page);
            } catch (error) {
                if (isAxiosError(error)) {
                    if (
                        error.response?.status === 401 ||
                        error.response?.status === 434
                    ) {
                        logOut();
                    } else {
                        showToast(
                            "error",
                            "Lỗi tải dữ liệu",
                            error.response?.data.error ||
                                "Không thể tải dữ liệu."
                        );
                    }
                } else {
                    showToast(
                        "error",
                        "Lỗi",
                        "Lỗi không xác định khi tải dữ liệu."
                    );
                }
            } finally {
                setLoading(false);
                setIsRefreshing(false);
            }
        },
        []
    );

    useEffect(() => {
        fetchExpenses(currentPage, filters);
    }, [currentPage, filters, fetchExpenses]);

    const onRefresh = useCallback(() => {
        setIsRefreshing(true);
        fetchExpenses(1, filters, true);
    }, [filters, fetchExpenses]);

    const formatDate = (dateString: string) => {
        if (!dateString) return "";
        const date = new Date(dateString);
        return date.toLocaleString("vi-VN", {
            year: "numeric",
            month: "numeric",
            day: "numeric",
        });
    };

    const formatAmount = (amount: number) => {
        return amount.toLocaleString("vi-VN", {
            style: "currency",
            currency: "VND",
        });
    };

    const handleFilterChange = (key: keyof FilterParams, value: string) => {
        setTempFilters((prev) => ({ ...prev, [key]: value }));
    };

    const handleDateChange = (
        event: DateTimePickerEvent,
        selectedDate: Date | undefined,
        type: "startDate" | "endDate"
    ) => {
        if (type === "startDate") setShowStartDatePicker(false);
        else setShowEndDatePicker(false);

        if (event.type === "set" && selectedDate) {
            const year = selectedDate.getFullYear();
            const month = String(selectedDate.getMonth() + 1).padStart(2, "0");
            const day = String(selectedDate.getDate()).padStart(2, "0");

            const localDateString = `${year}-${month}-${day}`;

            handleFilterChange(type, localDateString);
        }
    };

    const clearFilter = (type: keyof FilterParams) => {
        handleFilterChange(type, "");
    };

    const applyFilters = () => {
        setFilters(tempFilters);
        setCurrentPage(1);
        setFilterModalVisible(false);
    };

    const cancelFilters = () => {
        setTempFilters(filters);
        setFilterModalVisible(false);
    };

    const handleEdit = (expense: UserExpense) => {
        setEditingExpense(expense);
        setEditModalVisible(true);
    };

    const handleUpdateExpense = async (updatedExpense: {
        id: number;
        amount: any;
        description: string;
        expense_date: string;
    }) => {
        if (!updatedExpense.description || !updatedExpense.amount) {
            showToast(
                "error",
                "Thiếu thông tin",
                "Vui lòng điền mô tả và số tiền."
            );
            return;
        }

        setLoadingAction(true);
        try {
            await axios.put(
                `${Config.API_BASE_URL}/api/v1/user/expenses/${updatedExpense.id}`,
                {
                    amount: parseFloat(updatedExpense.amount),
                    description: updatedExpense.description,
                    expense_date: updatedExpense.expense_date.split("T")[0],
                },
                {
                    headers: {
                        Authorization: `Bearer ${await AsyncStorage.getItem(
                            "token"
                        )}`,
                    },
                }
            );

            showToast(
                "success",
                "Thành công",
                "Cập nhật khoản thu chi thành công."
            );
            setEditModalVisible(false);
            setEditingExpense(null);
            fetchExpenses(currentPage, filters);
        } catch (error) {
            if (isAxiosError(error)) {
                if (
                    error.response?.status === 401 ||
                    error.response?.status === 434
                ) {
                    logOut();
                } else {
                    showToast(
                        "error",
                        "Lỗi cập nhật",
                        error.response?.data.error ||
                            "Không thể cập nhật thu chi."
                    );
                }
            } else {
                showToast("error", "Lỗi", "Lỗi không xác định khi cập nhật.");
            }
        } finally {
            setLoadingAction(false);
        }
    };

    const handleAddExpense = async (addExpense: {
        amount: any;
        description: string;
        expense_date: string;
    }) => {
        if (
            !addExpense.description ||
            !addExpense.amount ||
            !addExpense.expense_date
        ) {
            showToast(
                "error",
                "Thiếu thông tin",
                "Vui lòng điền đầy đủ thông tin."
            );
            return;
        }

        setLoadingAction(true);
        try {
            await axios.post(
                `${Config.API_BASE_URL}/api/v1/user/expenses`,
                {
                    expenses: [
                        {
                            amount: parseFloat(addExpense.amount),
                            description: addExpense.description,
                            expense_date: addExpense.expense_date.split("T")[0],
                        },
                    ],
                },
                {
                    headers: {
                        Authorization: `Bearer ${await AsyncStorage.getItem(
                            "token"
                        )}`,
                    },
                }
            );

            showToast("success", "Thành công", "Thêm mới thành công.");
            setAddModalVisible(false);
            setNewExpense({
                description: "",
                amount: "",
                expense_date: "",
            });
            fetchExpenses(currentPage, filters);
        } catch (error) {
            if (isAxiosError(error)) {
                if (
                    error.response?.status === 401 ||
                    error.response?.status === 434
                ) {
                    logOut();
                } else {
                    showToast(
                        "error",
                        "Lỗi thêm mới",
                        error.response?.data.error || "Không thể thêm thu chi."
                    );
                }
            } else {
                showToast("error", "Lỗi", "Lỗi không xác định khi thêm mới.");
            }
        } finally {
            setLoadingAction(false);
        }
    };

    const handleDeleteExpense = async (expenseId: number) => {
        setLoadingAction(true);
        try {
            await axios.delete(
                `${Config.API_BASE_URL}/api/v1/user/expenses/${expenseId}`,
                {
                    headers: {
                        Authorization: `Bearer ${await AsyncStorage.getItem(
                            "token"
                        )}`,
                    },
                }
            );

            showToast("success", "Thành công", "Đã xóa khoản thu chi.");
            setEditModalVisible(false);
            setEditingExpense(null);
            fetchExpenses(currentPage, filters);
        } catch (error) {
            if (isAxiosError(error)) {
                if (
                    error.response?.status === 401 ||
                    error.response?.status === 434
                ) {
                    logOut();
                } else {
                    showToast(
                        "error",
                        "Lỗi xóa",
                        error.response?.data.error || "Không thể xóa."
                    );
                }
            } else {
                showToast("error", "Lỗi", "Lỗi không xác định khi xóa.");
            }
        } finally {
            setLoadingAction(false);
        }
    };

    const renderExpense = ({ item }: { item: UserExpense }) => (
        <TouchableOpacity style={styles.card} onPress={() => handleEdit(item)}>
            <View style={styles.cardHeader}>
                <Text style={styles.description}>{item.description}</Text>
                <Text
                    style={
                        item.amount < 0 ? styles.amountRed : styles.amountGreen
                    }
                >
                    {formatAmount(item.amount)}
                </Text>
            </View>
            <View style={styles.cardBody}>
                <View style={styles.infoRow}>
                    <Text style={styles.label}>ID:</Text>
                    <Text style={styles.value}>{item.id}</Text>
                </View>
                <View style={styles.infoRow}>
                    <Text style={styles.label}>Ngày thu chi:</Text>
                    <Text style={styles.value}>
                        {formatDate(item.expense_date)}
                    </Text>
                </View>
            </View>
        </TouchableOpacity>
    );

    const renderEmptyListComponent = () => (
        <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>
                Không tìm thấy khoản thu chi nào.
            </Text>
        </View>
    );

    const renderPaging = () => {
        const pageOptions = Array.from({ length: totalPages }, (_, i) => i + 1);
        return (
            <View style={styles.pagingContainer}>
                <TouchableOpacity
                    disabled={currentPage === 1}
                    onPress={() =>
                        setCurrentPage((prev) => Math.max(prev - 1, 1))
                    }
                    style={[
                        styles.pageButton,
                        currentPage === 1 && styles.disabledButton,
                        { marginRight: 10 },
                    ]}
                >
                    <Ionicons
                        name="arrow-back-circle-outline"
                        size={25}
                        color="#333"
                    />
                </TouchableOpacity>
                <View style={styles.pickerContainer}>
                    <Picker
                        selectedValue={currentPage}
                        onValueChange={(value) => setCurrentPage(value)}
                        style={styles.picker}
                    >
                        {pageOptions.map((page) => (
                            <Picker.Item
                                key={page}
                                label={`Trang ${page}`}
                                value={page}
                            />
                        ))}
                    </Picker>
                </View>
                <TouchableOpacity
                    disabled={currentPage === totalPages}
                    onPress={() =>
                        setCurrentPage((prev) => Math.min(prev + 1, totalPages))
                    }
                    style={[
                        styles.pageButton,
                        currentPage === totalPages && styles.disabledButton,
                        { marginLeft: 10 },
                    ]}
                >
                    <Ionicons
                        name="arrow-forward-circle-outline"
                        size={25}
                        color="#333"
                    />
                </TouchableOpacity>
            </View>
        );
    };

    return (
        <SafeAreaProvider>
            <SafeAreaView style={styles.container}>
                <View style={styles.filterButtonContainer}>
                    <TouchableOpacity
                        style={styles.filterButton}
                        onPress={() => setFilterModalVisible(true)}
                    >
                        <Ionicons name="filter" size={24} color="#fff" />
                        <Text style={styles.filterButtonText}>Lọc</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={styles.filterButton}
                        onPress={() => setAddModalVisible(true)}
                    >
                        <Ionicons name="add" size={24} color="#fff" />
                        <Text style={styles.filterButtonText}>Thêm</Text>
                    </TouchableOpacity>
                </View>

                {loading && !isRefreshing ? (
                    <View style={styles.loadingContainer}>
                        <ActivityIndicator size="large" color="#168118" />
                    </View>
                ) : (
                    <FlatList
                        data={expenses}
                        renderItem={renderExpense}
                        keyExtractor={(item) => item.id.toString()}
                        contentContainerStyle={styles.listContainer}
                        showsVerticalScrollIndicator={false}
                        ListFooterComponent={
                            !isRefreshing ? renderPaging : null
                        }
                        refreshControl={
                            <RefreshControl
                                refreshing={isRefreshing}
                                onRefresh={onRefresh}
                                colors={["#168118"]}
                                tintColor={"#168118"}
                            />
                        }
                        ListEmptyComponent={renderEmptyListComponent}
                    />
                )}

                {/* --- MODAL LỌC --- */}
                <Modal
                    visible={filterModalVisible}
                    animationType="slide"
                    transparent={true}
                    onRequestClose={cancelFilters}
                >
                    <View style={styles.modalContainer}>
                        <View style={styles.modalContent}>
                            <Text style={styles.modalTitle}>Lọc thu chi</Text>

                            <View style={styles.filterSortContainer}>
                                <View style={{ flex: 1 }}>
                                    <TouchableOpacity
                                        style={styles.toggleButton}
                                        onPress={() =>
                                            handleFilterChange(
                                                "sortField",
                                                tempFilters.sortField ===
                                                    "expense_date"
                                                    ? "amount"
                                                    : "expense_date"
                                            )
                                        }
                                    >
                                        <Text style={styles.toggleButtonText}>
                                            {tempFilters.sortField ===
                                            "expense_date"
                                                ? "Xếp theo giá"
                                                : "Xếp theo ngày"}
                                        </Text>
                                    </TouchableOpacity>
                                </View>
                                <View style={{ flex: 1 }}>
                                    <TouchableOpacity
                                        style={styles.toggleButton}
                                        onPress={() =>
                                            handleFilterChange(
                                                "sortOrder",
                                                tempFilters.sortOrder === "asc"
                                                    ? "desc"
                                                    : "asc"
                                            )
                                        }
                                    >
                                        <Text style={styles.toggleButtonText}>
                                            {tempFilters.sortOrder === "asc"
                                                ? "Tăng dần"
                                                : "Giảm dần"}
                                        </Text>
                                    </TouchableOpacity>
                                </View>
                            </View>
                            {/* ... Giữ nguyên phần input Lọc ... */}
                            <View style={styles.datePickerContainer}>
                                <Ionicons
                                    name="text-outline"
                                    size={25}
                                    style={{ paddingRight: 10 }}
                                />
                                <TextInput
                                    style={styles.modalInput}
                                    placeholder="Từ khóa..."
                                    placeholderTextColor="#807979ff"
                                    value={tempFilters.keyword}
                                    onChangeText={(text) =>
                                        handleFilterChange("keyword", text)
                                    }
                                />
                                {tempFilters.keyword && (
                                    <TouchableOpacity
                                        style={styles.clearButton}
                                        onPress={() => clearFilter("keyword")}
                                    >
                                        <Ionicons
                                            name="close"
                                            size={20}
                                            color="#666"
                                        />
                                    </TouchableOpacity>
                                )}
                            </View>
                            <View style={styles.datePickerContainer}>
                                <Ionicons
                                    name="calendar-outline"
                                    size={25}
                                    style={{ paddingRight: 10 }}
                                />
                                <TouchableOpacity
                                    style={styles.dateButton}
                                    onPress={() => setShowStartDatePicker(true)}
                                >
                                    <Text
                                        style={
                                            tempFilters.startDate
                                                ? styles.dateButtonText
                                                : styles.dateButtonTextPlaceholder
                                        }
                                    >
                                        {tempFilters.startDate
                                            ? formatDate(tempFilters.startDate)
                                            : "Ngày bắt đầu..."}
                                    </Text>
                                </TouchableOpacity>
                                {tempFilters.startDate && (
                                    <TouchableOpacity
                                        style={styles.clearButton}
                                        onPress={() => clearFilter("startDate")}
                                    >
                                        <Ionicons
                                            name="close"
                                            size={20}
                                            color="#666"
                                        />
                                    </TouchableOpacity>
                                )}
                            </View>
                            {showStartDatePicker && (
                                <DateTimePicker
                                    value={
                                        tempFilters.startDate
                                            ? new Date(tempFilters.startDate)
                                            : new Date()
                                    }
                                    mode="date"
                                    display="default"
                                    onChange={(event, date) =>
                                        handleDateChange(
                                            event,
                                            date,
                                            "startDate"
                                        )
                                    }
                                />
                            )}
                            <View style={styles.datePickerContainer}>
                                <Ionicons
                                    name="calendar"
                                    size={25}
                                    style={{ paddingRight: 10 }}
                                />
                                <TouchableOpacity
                                    style={styles.dateButton}
                                    onPress={() => setShowEndDatePicker(true)}
                                >
                                    <Text
                                        style={
                                            tempFilters.endDate
                                                ? styles.dateButtonText
                                                : styles.dateButtonTextPlaceholder
                                        }
                                    >
                                        {tempFilters.endDate
                                            ? formatDate(tempFilters.endDate)
                                            : "Ngày kết thúc..."}
                                    </Text>
                                </TouchableOpacity>
                                {tempFilters.endDate && (
                                    <TouchableOpacity
                                        style={styles.clearButton}
                                        onPress={() => clearFilter("endDate")}
                                    >
                                        <Ionicons
                                            name="close"
                                            size={20}
                                            color="#666"
                                        />
                                    </TouchableOpacity>
                                )}
                            </View>
                            {showEndDatePicker && (
                                <DateTimePicker
                                    value={
                                        tempFilters.endDate
                                            ? new Date(tempFilters.endDate)
                                            : new Date()
                                    }
                                    mode="date"
                                    display="default"
                                    onChange={(event, date) =>
                                        handleDateChange(event, date, "endDate")
                                    }
                                />
                            )}
                            {/* ... (Giữ nguyên các input minAmount/maxAmount) ... */}
                            <View style={styles.datePickerContainer}>
                                <Ionicons
                                    name="pricetag-outline"
                                    size={25}
                                    style={{ paddingRight: 10 }}
                                />
                                <TextInput
                                    style={styles.modalInput}
                                    placeholder="Số tiền tối thiểu..."
                                    placeholderTextColor="#807979ff"
                                    value={tempFilters.minAmount}
                                    onChangeText={(text) =>
                                        handleFilterChange("minAmount", text)
                                    }
                                    keyboardType="numeric"
                                />
                                {tempFilters.minAmount && (
                                    <TouchableOpacity
                                        style={styles.clearButton}
                                        onPress={() => clearFilter("minAmount")}
                                    >
                                        <Ionicons
                                            name="close"
                                            size={20}
                                            color="#666"
                                        />
                                    </TouchableOpacity>
                                )}
                            </View>
                            <View style={styles.datePickerContainer}>
                                <Ionicons
                                    name="pricetag"
                                    size={25}
                                    style={{ paddingRight: 10 }}
                                />
                                <TextInput
                                    style={styles.modalInput}
                                    placeholder="Số tiền tối đa..."
                                    placeholderTextColor="#807979ff"
                                    value={tempFilters.maxAmount}
                                    onChangeText={(text) =>
                                        handleFilterChange("maxAmount", text)
                                    }
                                    keyboardType="numeric"
                                />
                                {tempFilters.maxAmount && (
                                    <TouchableOpacity
                                        style={styles.clearButton}
                                        onPress={() => clearFilter("maxAmount")}
                                    >
                                        <Ionicons
                                            name="close"
                                            size={20}
                                            color="#666"
                                        />
                                    </TouchableOpacity>
                                )}
                            </View>

                            <View style={styles.modalButtons}>
                                <TouchableOpacity
                                    style={[
                                        styles.modalButton,
                                        styles.cancelButton,
                                    ]}
                                    onPress={cancelFilters}
                                >
                                    <Text style={styles.modalButtonText}>
                                        Hủy
                                    </Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[
                                        styles.modalButton,
                                        styles.saveButton,
                                    ]}
                                    onPress={applyFilters}
                                >
                                    <Text style={styles.modalButtonText}>
                                        Áp dụng
                                    </Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </View>
                </Modal>

                {/* --- MODAL THÊM MỚI --- */}
                <Modal
                    visible={addModalVisible}
                    animationType="slide"
                    transparent={true}
                    onRequestClose={() =>
                        !loadingAction && setAddModalVisible(false)
                    }
                >
                    <View style={styles.modalContainer}>
                        <View style={styles.modalContent}>
                            <Text style={styles.modalTitle}>
                                Thêm thu chi mới
                            </Text>
                            {newExpense && (
                                <>
                                    <View
                                        style={{
                                            flexDirection: "row",
                                            alignItems: "center",
                                        }}
                                    >
                                        <Ionicons
                                            name="text-outline"
                                            size={25}
                                            color="#333"
                                            style={{
                                                paddingBottom: 12,
                                                paddingRight: 10,
                                            }}
                                        />
                                        <TextInput
                                            style={styles.editInput}
                                            value={newExpense.description}
                                            onChangeText={(text) =>
                                                setNewExpense({
                                                    ...newExpense,
                                                    description: text,
                                                })
                                            }
                                            placeholder="Mô tả"
                                            placeholderTextColor="#807979ff"
                                            editable={!loadingAction}
                                        />
                                    </View>

                                    <View
                                        style={{
                                            flexDirection: "row",
                                            alignItems: "center",
                                        }}
                                    >
                                        <Ionicons
                                            name="pricetag-outline"
                                            size={25}
                                            color="#333"
                                            style={{
                                                paddingRight: 10,
                                                paddingBottom: 12,
                                            }}
                                        />
                                        <TextInput
                                            style={styles.editInput}
                                            value={newExpense.amount.toString()}
                                            onChangeText={(input) => {
                                                setNewExpense({
                                                    ...newExpense,
                                                    amount: input,
                                                });
                                            }}
                                            keyboardType="numeric"
                                            placeholder="Số tiền"
                                            placeholderTextColor="#807979ff"
                                            editable={!loadingAction}
                                        />
                                    </View>

                                    <View style={styles.datePickerContainer}>
                                        <Ionicons
                                            name="calendar-outline"
                                            size={25}
                                            color="#333"
                                            style={{ paddingRight: 10 }}
                                        />
                                        <TouchableOpacity
                                            style={styles.dateButton}
                                            onPress={() =>
                                                !loadingAction &&
                                                setShowEditDatePicker(true)
                                            }
                                        >
                                            <Text
                                                style={
                                                    newExpense.expense_date
                                                        ? styles.dateButtonText
                                                        : styles.dateButtonTextPlaceholder
                                                }
                                            >
                                                {newExpense.expense_date
                                                    ? formatDate(
                                                          newExpense.expense_date
                                                      )
                                                    : "Ngày thu chi"}
                                            </Text>
                                        </TouchableOpacity>
                                    </View>

                                    {showEditDatePicker && (
                                        <DateTimePicker
                                            value={
                                                newExpense.expense_date
                                                    ? new Date(
                                                          newExpense.expense_date
                                                      )
                                                    : new Date()
                                            }
                                            mode="date"
                                            display="default"
                                            onChange={(event, date) => {
                                                if (
                                                    event.type === "set" &&
                                                    date
                                                ) {
                                                    setNewExpense({
                                                        ...newExpense,
                                                        expense_date:
                                                            date.toLocaleDateString(
                                                                "en-CA",
                                                                {
                                                                    timeZone:
                                                                        "Asia/Ho_Chi_Minh",
                                                                }
                                                            ),
                                                    });
                                                }
                                                setShowEditDatePicker(false);
                                            }}
                                        />
                                    )}

                                    <View style={styles.modalButtons}>
                                        <TouchableOpacity
                                            style={[
                                                styles.modalButton,
                                                styles.cancelButton,
                                            ]}
                                            onPress={() => {
                                                setAddModalVisible(false);
                                                setNewExpense({
                                                    description: "",
                                                    amount: "",
                                                    expense_date: "",
                                                });
                                            }}
                                            disabled={loadingAction}
                                        >
                                            <Text
                                                style={styles.modalButtonText}
                                            >
                                                Hủy
                                            </Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity
                                            style={[
                                                styles.modalButton,
                                                styles.saveButton,
                                            ]}
                                            onPress={() =>
                                                handleAddExpense(newExpense)
                                            }
                                            disabled={loadingAction}
                                        >
                                            {loadingAction ? (
                                                <ActivityIndicator
                                                    size="small"
                                                    color="#fff"
                                                />
                                            ) : (
                                                <Text
                                                    style={
                                                        styles.modalButtonText
                                                    }
                                                >
                                                    Lưu
                                                </Text>
                                            )}
                                        </TouchableOpacity>
                                    </View>
                                </>
                            )}
                        </View>
                    </View>
                </Modal>
                <Modal
                    visible={editModalVisible}
                    animationType="slide"
                    transparent={true}
                    onRequestClose={() =>
                        !loadingAction && setEditModalVisible(false)
                    }
                >
                    <View style={styles.modalContainer}>
                        <View style={styles.modalContent}>
                            <Text style={styles.modalTitle}>
                                Chỉnh sửa thu chi
                            </Text>
                            <TouchableOpacity
                                style={{
                                    position: "absolute",
                                    top: 20,
                                    right: 20,
                                    backgroundColor: "red",
                                    width: 30,
                                    height: 30,
                                    justifyContent: "center",
                                    alignItems: "center",
                                    borderRadius: 50,
                                    opacity: loadingAction ? 0.6 : 1,
                                }}
                                disabled={loadingAction}
                                onPress={() => {
                                    if (editingExpense) {
                                        confirmDelete(editingExpense);
                                    }
                                }}
                            >
                                {loadingAction ? (
                                    <ActivityIndicator
                                        size="small"
                                        color="#fff"
                                    />
                                ) : (
                                    <Ionicons
                                        name="trash"
                                        size={20}
                                        color="#fff"
                                    />
                                )}
                            </TouchableOpacity>

                            {editingExpense && (
                                <>
                                    <View
                                        style={{
                                            flexDirection: "row",
                                            alignItems: "center",
                                        }}
                                    >
                                        <Ionicons
                                            name="text-outline"
                                            size={25}
                                            color="#333"
                                            style={{
                                                paddingBottom: 12,
                                                paddingRight: 10,
                                            }}
                                        />
                                        <TextInput
                                            style={styles.editInput}
                                            value={editingExpense.description}
                                            onChangeText={(text) =>
                                                setEditingExpense({
                                                    ...editingExpense,
                                                    description: text,
                                                })
                                            }
                                            placeholder="Mô tả"
                                            placeholderTextColor="#807979ff"
                                            editable={!loadingAction}
                                        />
                                    </View>

                                    <View
                                        style={{
                                            flexDirection: "row",
                                            alignItems: "center",
                                            width: "100%",
                                        }}
                                    >
                                        <Ionicons
                                            name="pricetag-outline"
                                            size={25}
                                            color="#333"
                                            style={{
                                                paddingRight: 10,
                                                paddingBottom: 12,
                                            }}
                                        />
                                        <TextInput
                                            style={styles.editInput}
                                            value={editingExpense.amount.toString()}
                                            onChangeText={(input) => {
                                                setEditingExpense({
                                                    ...editingExpense,
                                                    amount: input,
                                                });
                                            }}
                                            keyboardType="numeric"
                                            placeholder="Số tiền"
                                            placeholderTextColor="#807979ff"
                                            editable={!loadingAction}
                                        />
                                    </View>

                                    <View>
                                        <View
                                            style={styles.datePickerContainer}
                                        >
                                            <Ionicons
                                                name="calendar-outline"
                                                size={25}
                                                color="#333"
                                                style={{ paddingRight: 10 }}
                                            />
                                            <TouchableOpacity
                                                style={styles.dateButton}
                                                onPress={() =>
                                                    !loadingAction &&
                                                    setShowEditDatePicker(true)
                                                }
                                            >
                                                <Text
                                                    style={
                                                        editingExpense.expense_date
                                                            ? styles.dateButtonText
                                                            : styles.dateButtonTextPlaceholder
                                                    }
                                                >
                                                    {editingExpense.expense_date
                                                        ? formatDate(
                                                              editingExpense.expense_date
                                                          )
                                                        : "Ngày thu chi"}
                                                </Text>
                                            </TouchableOpacity>
                                        </View>
                                    </View>

                                    {showEditDatePicker && (
                                        <DateTimePicker
                                            value={
                                                editingExpense.expense_date
                                                    ? new Date(
                                                          editingExpense.expense_date
                                                      )
                                                    : new Date()
                                            }
                                            mode="date"
                                            display="default"
                                            onChange={(event, date) => {
                                                if (
                                                    event.type === "set" &&
                                                    date
                                                ) {
                                                    setEditingExpense({
                                                        ...editingExpense,
                                                        expense_date:
                                                            date.toLocaleDateString(
                                                                "en-CA",
                                                                {
                                                                    timeZone:
                                                                        "Asia/Ho_Chi_Minh",
                                                                }
                                                            ),
                                                    });
                                                }
                                                setShowEditDatePicker(false);
                                            }}
                                        />
                                    )}

                                    <View style={styles.modalButtons}>
                                        <TouchableOpacity
                                            style={[
                                                styles.modalButton,
                                                styles.cancelButton,
                                            ]}
                                            onPress={() =>
                                                setEditModalVisible(false)
                                            }
                                            disabled={loadingAction}
                                        >
                                            <Text
                                                style={styles.modalButtonText}
                                            >
                                                Hủy
                                            </Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity
                                            style={[
                                                styles.modalButton,
                                                styles.saveButton,
                                            ]}
                                            onPress={() =>
                                                handleUpdateExpense(
                                                    editingExpense
                                                )
                                            }
                                            disabled={loadingAction}
                                        >
                                            {loadingAction ? (
                                                <ActivityIndicator
                                                    size="small"
                                                    color="#fff"
                                                />
                                            ) : (
                                                <Text
                                                    style={
                                                        styles.modalButtonText
                                                    }
                                                >
                                                    Lưu
                                                </Text>
                                            )}
                                        </TouchableOpacity>
                                    </View>
                                </>
                            )}
                        </View>
                    </View>
                </Modal>
                <Toast />
            </SafeAreaView>
        </SafeAreaProvider>
    );
}

const { width } = Dimensions.get("window");
const isSmallScreen = width < 400;
const fontAdjustment = isSmallScreen ? -2 : 0;
const spacingAdjustment = isSmallScreen ? -2 : 0;

const styles = StyleSheet.create({
    container: {
        flex: 1,
        position: "relative",
    },
    filterButtonContainer: {
        display: "flex",
        flexDirection: "row",
        paddingHorizontal: 16 + spacingAdjustment,
        paddingVertical: 16 + spacingAdjustment,
        gap: 12 + spacingAdjustment,
    },
    filterButton: {
        flex: 1,
        flexDirection: "row",
        backgroundColor: "#0078ff",
        borderRadius: 8,
        padding: 10 + spacingAdjustment,
        alignItems: "center",
        justifyContent: "center",
    },
    filterButtonText: {
        color: "#fff",
        fontSize: 16 + fontAdjustment,
        fontWeight: "bold",
        marginLeft: 8 + spacingAdjustment,
    },
    listContainer: {
        padding: 16 + spacingAdjustment,
        paddingTop: 0,
        paddingBottom: 20 + spacingAdjustment,
    },
    card: {
        backgroundColor: "#fff",
        borderRadius: 12,
        marginBottom: 16 + spacingAdjustment,
        padding: 16 + spacingAdjustment,
        shadowColor: "#000",
        shadowOpacity: 0.1,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 2 },
        elevation: 4,
        width: width - 32 - spacingAdjustment * 2,
    },
    cardHeader: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 12 + spacingAdjustment,
    },
    description: {
        fontSize: 18 + fontAdjustment,
        fontWeight: "bold",
        color: "#333",
        flex: 1,
    },
    amountRed: {
        fontSize: 18 + fontAdjustment,
        fontWeight: "bold",
        color: "#dc3545ff",
    },
    amountGreen: {
        fontSize: 18 + fontAdjustment,
        fontWeight: "bold",
        color: "#168118",
    },
    cardBody: {
        borderTopWidth: 1,
        borderTopColor: "#eee",
        paddingTop: 12 + spacingAdjustment,
    },
    infoRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        marginBottom: 8 + spacingAdjustment,
    },
    label: {
        fontSize: 14 + fontAdjustment,
        color: "#666",
        fontWeight: "600",
    },
    value: {
        fontSize: 14 + fontAdjustment,
        color: "#333",
    },
    pagingContainer: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        padding: 16 + spacingAdjustment,
    },
    pickerContainer: {
        flex: 1,
        marginHorizontal: 8 + spacingAdjustment,
        borderRadius: 8,
        backgroundColor: "#f0f0f0",
    },
    picker: {
        height: 52,
        color: "#000000ff",
    },
    pageButton: {
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: "#0078ff",
        borderRadius: 8,
        padding: 10 + spacingAdjustment,
    },
    disabledButton: {
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: "#ccc",
        borderRadius: 8,
        padding: 10 + spacingAdjustment,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
    },
    modalContainer: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: "rgba(0,0,0,0.5)",
    },
    modalContent: {
        position: "relative",
        backgroundColor: "#fff",
        borderRadius: 12,
        padding: 20 + spacingAdjustment,
        width: width - 40,
    },
    modalTitle: {
        fontSize: 20 + fontAdjustment,
        fontWeight: "bold",
        marginBottom: 16 + spacingAdjustment,
        textAlign: "center",
    },
    modalInput: {
        flex: 1,
        backgroundColor: "#f0f0f0",
        borderRadius: 8,
        padding: 10 + spacingAdjustment,
        fontSize: 16 + fontAdjustment,
    },
    editInput: {
        flex: 1,
        backgroundColor: "#f0f0f0",
        borderRadius: 8,
        fontSize: 16 + fontAdjustment,
        paddingHorizontal: 10 + spacingAdjustment,
        marginBottom: 12 + spacingAdjustment,
        paddingVertical: 10,
    },
    datePickerContainer: {
        flexDirection: "row",
        alignItems: "center",
        marginBottom: 12 + spacingAdjustment,
    },
    dateButton: {
        backgroundColor: "#f0f0f0",
        borderRadius: 8,
        padding: 10 + spacingAdjustment,
        flex: 1,
    },
    dateButtonText: {
        fontSize: 16 + fontAdjustment,
        color: "#333",
    },
    dateButtonTextPlaceholder: {
        fontSize: 16 + fontAdjustment,
        color: "#807979ff",
    },
    clearButton: {
        marginLeft: 8 + spacingAdjustment,
        padding: 8 + spacingAdjustment,
    },
    modalButtons: {
        flexDirection: "row",
        justifyContent: "space-between",
        marginTop: 10,
    },
    modalButton: {
        flex: 1,
        borderRadius: 8,
        padding: 12 + spacingAdjustment,
        marginHorizontal: 8 + spacingAdjustment,
        alignItems: "center",
        justifyContent: "center",
    },
    cancelButton: {
        backgroundColor: "#ff0000ff",
    },
    saveButton: {
        backgroundColor: "#0078ff",
    },
    modalButtonText: {
        color: "#fff",
        fontSize: 16 + fontAdjustment,
        fontWeight: "bold",
    },
    toggleButton: {
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        padding: 10 + spacingAdjustment,
        backgroundColor: "#0078ff",
        borderRadius: 8,
    },
    toggleButtonText: {
        color: "#fff",
        fontSize: 14 + fontAdjustment,
        fontWeight: "bold",
        textAlign: "center",
    },
    emptyContainer: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        height: 100,
    },
    emptyText: {
        fontSize: 16 + fontAdjustment,
        color: "#888",
    },
    filterSortContainer: {
        flexDirection: "row",
        gap: 10 + spacingAdjustment,
        marginBottom: 12 + spacingAdjustment,
    },
});
