import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import DateTimePicker, {
    DateTimePickerEvent,
} from "@react-native-community/datetimepicker";
import { GoogleSignin } from "@react-native-google-signin/google-signin";
import axios, { isAxiosError } from "axios";
import * as ImagePicker from "expo-image-picker";
import { router } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
    ActivityIndicator,
    Dimensions,
    FlatList,
    KeyboardAvoidingView,
    StyleSheet,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import ConfirmationBubble from "../../assets/component/chat/ConfirmationBubble";
import {
    ConfirmationContext,
    Message,
} from "../../assets/component/chat/MessageTypes";
import QueryResultBubble from "../../assets/component/chat/QueryResultBubble";
import StandardMessageBubble from "../../assets/component/chat/StandardMessageBubble";
import CustomToast from "../../assets/component/CustomToast";
import { Config } from "../../config";

const formatTimestamp = (isoString: string) => {
    try {
        const date = new Date(isoString);

        return date.toLocaleString("vi-VN", {
            hour: "2-digit",
            minute: "2-digit",
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
        });
    } catch (e) {
        console.error("Invalid timestamp:", isoString, e);
        return "--:--";
    }
};

const formatDate = (date: Date) => {
    return date.toISOString().split("T")[0];
};

export default function ChatScreen() {
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState("");
    const [isBotTyping, setIsBotTyping] = useState(false);
    const flatListRef = useRef<FlatList>(null);
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [editingDateIndex, setEditingDateIndex] = useState<number | string>(
        ""
    );
    const [currentDate, setCurrentDate] = useState(new Date());
    const [confirmationContext, setConfirmationContext] =
        useState<ConfirmationContext | null>(null);

    const [isRefreshing, setIsRefreshing] = useState(false);
    const [isLoadingOlder, setIsLoadingOlder] = useState(false);
    const [isInitialLoading, setIsInitialLoading] = useState(true);
    const [pendingScrollToEnd, setPendingScrollToEnd] = useState(false);

    const [toast, setToast] = useState({
        isVisible: false,
        message: "",
        type: "error" as "success" | "error" | "info",
    });

    const showError = (text: string) => {
        setToast({
            isVisible: true,
            message: text,
            type: "error",
        });
        setIsBotTyping(false);
    };

    const showSuccess = (text: string) => {
        setToast({
            isVisible: true,
            message: text,
            type: "success",
        });
    };

    const logOut = async () => {
        try {
            await AsyncStorage.removeItem("token");
            await AsyncStorage.removeItem("user");
            await GoogleSignin.signOut();
            router.replace("/login");
        } catch (error) {
            console.error("Logout error", error);
            router.replace("/login");
        }
    };

    const handleApiError = (error: any, defaultMessage: string) => {
        setIsBotTyping(false);
        setIsInitialLoading(false);
        setIsRefreshing(false);

        if (isAxiosError(error)) {
            const status = error.response?.status;
            console.error(`API Error (${status}):`, error.message);
            if (status === 401 || status === 434) {
                logOut();
                return;
            }
            const backendMessage =
                error.response?.data?.error || error.response?.data?.message;
            showError(backendMessage || defaultMessage);
        } else {
            console.error("Unexpected Error:", error);
            showError(defaultMessage);
        }
    };

    const removeConfirmationMessage = (id: string) => {
        setMessages((prevMessages) =>
            prevMessages.filter((message) => message.id !== id)
        );
    };

    const handleConfirmationInsertDataChange = (
        index: number,
        field: "description" | "amount" | "expense_date" | "submit",
        value: string | boolean
    ) => {
        if (!confirmationContext) return;

        const insertedExpenses = confirmationContext.data.expenses.map(
            (item: any, i: number) => {
                if (i === index) {
                    if (field === "submit") {
                        return { ...item, [field]: value };
                    }

                    const stringValue = value as string;
                    let finalValue: string | number = stringValue;

                    if (field === "amount") {
                        if (
                            stringValue === "" ||
                            stringValue === "-" ||
                            /^-?\d+$/.test(stringValue)
                        ) {
                            finalValue = stringValue;
                        } else {
                            finalValue = item.amount;
                        }
                    }
                    return { ...item, [field]: finalValue };
                }
                return item;
            }
        );

        setConfirmationContext((prevContext) => {
            if (!prevContext) return null;
            return {
                ...prevContext,
                data: {
                    ...prevContext.data,
                    expenses: insertedExpenses,
                },
            };
        });
    };

    const handleConfirmationUpdateDataChange = (
        field: "updated_amount" | "updated_date" | "updated_description",
        value: string
    ) => {
        setConfirmationContext((prevContext) => {
            if (!prevContext) return null;
            let updatedValue: any;
            if (field === "updated_amount") {
                if (value === "" || value === "-" || /^-?\d+$/.test(value)) {
                    updatedValue = value;
                } else {
                    updatedValue = prevContext.data[field];
                }
            } else {
                updatedValue = value;
            }
            const updatedData = {
                ...prevContext.data,
                [field]: updatedValue,
            };
            return {
                ...prevContext,
                data: updatedData,
            };
        });
    };

    const handleConfirmationDeleteDataChange = (
        index: number,
        field: "submit",
        value: boolean
    ) => {
        if (
            !confirmationContext ||
            confirmationContext.request_type !== "delete_expenses"
        )
            return;

        const updatedExpenses = confirmationContext.data.map(
            (item: any, i: number) => {
                if (i === index) {
                    return { ...item, [field]: value };
                }
                return item;
            }
        );

        setConfirmationContext((prevContext) => ({
            ...prevContext!,
            data: updatedExpenses,
        }));
    };

    const handleConfirmationQueryDataChange = (
        field:
            | "start_date"
            | "end_date"
            | "min_amount"
            | "max_amount"
            | "key_words",
        value: string
    ) => {
        if (!confirmationContext) return;

        let processedValue: string | string[] = value;

        if (field === "key_words") {
            processedValue = value
                .split(",")
                .map((item) => item.trim())
                .filter((item) => item.length > 0);
        }

        const updatedQuery = {
            ...confirmationContext.data,
            [field]: processedValue,
        };

        setConfirmationContext((prevContext) => {
            if (!prevContext) return null;
            return {
                ...prevContext,
                data: updatedQuery,
            };
        });
    };

    const onDateChange = (event: DateTimePickerEvent, selectedDate?: Date) => {
        setShowDatePicker(false);

        if (event.type === "set" && selectedDate) {
            const formattedDate = formatDate(selectedDate);
            if (typeof editingDateIndex === "number") {
                handleConfirmationInsertDataChange(
                    editingDateIndex,
                    "expense_date",
                    formattedDate
                );
            } else if (editingDateIndex === "update_date") {
                handleConfirmationUpdateDataChange(
                    "updated_date",
                    formattedDate
                );
            } else if (editingDateIndex === "query_start") {
                handleConfirmationQueryDataChange("start_date", formattedDate);
            } else if (editingDateIndex === "query_end") {
                handleConfirmationQueryDataChange("end_date", formattedDate);
            }
            setEditingDateIndex("");
        } else {
            setEditingDateIndex("");
        }
    };

    const openDatePicker = (
        index: number | string,
        currentDateString: string
    ) => {
        setEditingDateIndex(index);
        setCurrentDate(new Date(currentDateString) || new Date());
        setShowDatePicker(true);
    };

    const handleCancelConfirmation = async () => {
        if (!confirmationContext) return;

        const originalMessage = messages;
        setIsBotTyping(true);
        try {
            const token = await AsyncStorage.getItem("token");
            await axios.delete(
                `${Config.API_BASE_URL}/api/v1/user/message/${confirmationContext.id}`,
                { headers: { Authorization: `Bearer ${token}` } }
            );
            removeConfirmationMessage(confirmationContext.id);
            setConfirmationContext(null);
            setIsBotTyping(false);
        } catch (error) {
            // Handle error but restore UI
            handleApiError(error, "Lỗi khi hủy yêu cầu");
            setMessages([
                ...originalMessage,
                {
                    id: "-1",
                    text: "Xin lỗi, không thể xác nhận hành động.",
                    sender: "bot",
                    timestamp: new Date().toISOString(),
                },
            ]);
        }
    };

    const handleConfirmConfirmation = async () => {
        if (!confirmationContext) return;
        setIsBotTyping(true);
        let successMessage: Message;

        try {
            const token = await AsyncStorage.getItem("token");
            let response;

            if (confirmationContext.request_type === "insert_expenses") {
                const processedExpenses =
                    confirmationContext.data.expenses.reduce(
                        (acc: any, exp: any) => {
                            if (exp.submit === true) {
                                const newItem = {
                                    description: exp.description,
                                    amount: Number(exp.amount) || 0,
                                    expense_date: exp.expense_date,
                                };
                                acc.push(newItem);
                            }
                            return acc;
                        },
                        []
                    );

                if (processedExpenses.length === 0) {
                    showError("Vui lòng chọn khoản thu chi để thêm vào");
                    setIsBotTyping(false);
                    return;
                }

                response = await axios.post(
                    `${Config.API_BASE_URL}/api/v1/user/expenses`,
                    { expenses: processedExpenses },
                    { headers: { Authorization: `Bearer ${token}` } }
                );

                if (response.data && response.data.added_expenses) {
                    const addedCount = response.data.added_expenses.length;
                    let successText = `Đã thêm thành công ${addedCount} khoản:\n`;
                    response.data.added_expenses.forEach((exp: any) => {
                        const amountFormatted = new Intl.NumberFormat("vi-VN", {
                            style: "currency",
                            currency: "VND",
                        }).format(exp.amount);
                        const dateFormatted = exp.expense_date
                            ? new Intl.DateTimeFormat("vi-VN", {
                                  day: "2-digit",
                                  month: "2-digit",
                                  year: "numeric",
                              }).format(new Date(exp.expense_date))
                            : "Không rõ ngày";
                        successText += `[${exp.id}] ${dateFormatted}  ${exp.description}  ${amountFormatted}\n`;
                    });

                    response = await axios.post(
                        `${Config.API_BASE_URL}/api/v1/user/message`,
                        {
                            role: "assistant",
                            data_type: "text",
                            content: successText.trim(),
                        },
                        { headers: { Authorization: `Bearer ${token}` } }
                    );

                    successMessage = {
                        id: response.data.response.assistant_message.id.toString(),
                        text: response.data.response.assistant_message.content.data.message.trim(),
                        sender: "bot",
                        timestamp:
                            response.data.response.assistant_message.timestamp,
                    };

                    await axios.delete(
                        `${Config.API_BASE_URL}/api/v1/user/message/${confirmationContext.id}`,
                        { headers: { Authorization: `Bearer ${token}` } }
                    );
                    if (successMessage !== null) {
                        setMessages((prev) => [...prev, successMessage]);
                    }

                    removeConfirmationMessage(confirmationContext.id);
                    setConfirmationContext(null);
                    setIsBotTyping(false);
                    showSuccess("Đã thêm khoản chi tiêu thành công");
                    return;
                }
            } else if (confirmationContext.request_type === "update_expenses") {
                const updateBody: {
                    amount?: number;
                    description?: string;
                    expense_date?: string;
                } = {};

                const {
                    id,
                    updated_amount,
                    updated_description,
                    updated_date,
                    originalExpense,
                } = confirmationContext.data;

                const finalDescription =
                    updated_description ?? originalExpense.description;
                const finalAmount = updated_amount ?? originalExpense.amount;
                const finalDate = updated_date ?? originalExpense.expense_date;

                if (!finalDescription || finalDescription.trim() === "") {
                    showError("Mô tả không được để trống.");
                    return;
                }
                if (!finalDate || finalDate.trim() === "") {
                    showError("Ngày tháng không được để trống.");
                    return;
                }
                if (String(finalAmount) === "" || String(finalAmount) === "-") {
                    showError("Số tiền không hợp lệ.");
                    return;
                }

                const parsedFinalAmount = parseInt(String(finalAmount), 10);

                if (finalDescription.trim() !== originalExpense.description) {
                    updateBody.description = finalDescription.trim();
                }
                if (parsedFinalAmount !== originalExpense.amount) {
                    updateBody.amount = parsedFinalAmount;
                }
                if (finalDate !== originalExpense.expense_date) {
                    updateBody.expense_date = finalDate;
                }

                if (Object.keys(updateBody).length === 0) {
                    setMessages((prev) => [
                        ...prev,
                        {
                            id: Date.now().toString(),
                            text: "Không có thay đổi nào được thực hiện.",
                            sender: "bot",
                            timestamp: new Date().toISOString(),
                        },
                    ]);

                    await axios.delete(
                        `${Config.API_BASE_URL}/api/v1/user/message/${confirmationContext.id}`,
                        { headers: { Authorization: `Bearer ${token}` } }
                    );
                    setConfirmationContext(null);
                    setIsBotTyping(false);
                    return;
                }

                response = await axios.put(
                    `${Config.API_BASE_URL}/api/v1/user/expenses/${id}`,
                    updateBody,
                    { headers: { Authorization: `Bearer ${token}` } }
                );

                if (response.data && response.data.updated_expense) {
                    const exp = response.data.updated_expense;
                    const amountFormatted = new Intl.NumberFormat("vi-VN", {
                        style: "currency",
                        currency: "VND",
                    }).format(exp.amount);

                    const dateFormatted = exp.expense_date
                        ? new Intl.DateTimeFormat("vi-VN", {
                              day: "2-digit",
                              month: "2-digit",
                              year: "numeric",
                          }).format(new Date(exp.expense_date))
                        : "Không rõ ngày";

                    let successText =
                        `Đã cập nhật thành công khoản:\n` +
                        `[${exp.id}]\n` +
                        `   Mô tả: ${exp.description}\n` +
                        `   Số tiền: ${amountFormatted}\n` +
                        `   Ngày: ${dateFormatted}\n`;

                    response = await axios.post(
                        `${Config.API_BASE_URL}/api/v1/user/message`,
                        {
                            role: "assistant",
                            data_type: "text",
                            content: successText.trim(),
                        },
                        { headers: { Authorization: `Bearer ${token}` } }
                    );
                    successMessage = {
                        id: response.data.response.assistant_message.id.toString(),
                        text: response.data.response.assistant_message.content.data.message.trim(),
                        sender: "bot",
                        timestamp:
                            response.data.response.assistant_message.timestamp,
                    };
                    await axios.delete(
                        `${Config.API_BASE_URL}/api/v1/user/message/${confirmationContext.id}`,
                        { headers: { Authorization: `Bearer ${token}` } }
                    );
                    if (successMessage !== null) {
                        setMessages((prev) => [...prev, successMessage]);
                    }
                    removeConfirmationMessage(confirmationContext.id);
                    setConfirmationContext(null);
                    showSuccess("Cập nhật thành công");
                }
            } else if (confirmationContext.request_type === "delete_expenses") {
                const selectedIds = confirmationContext.data
                    .filter((exp: any) => exp.submit === true)
                    .map((exp: any) => exp.id);
                if (selectedIds.length === 0) {
                    showError("Bạn chưa chọn khoản nào để xóa.");
                    return;
                }
                response = await axios.put(
                    `${Config.API_BASE_URL}/api/v1/user/expenses`,
                    {
                        delete_ids: selectedIds,
                    },
                    { headers: { Authorization: `Bearer ${token}` } }
                );
                if (
                    response.data &&
                    response.data.deleted_count !== undefined
                ) {
                    const count = response.data.deleted_count;
                    let successText =
                        count > 0
                            ? `Đã xóa thành công ${count} khoản chi.`
                            : `Không có khoản chi nào được xóa`;

                    response = await axios.post(
                        `${Config.API_BASE_URL}/api/v1/user/message`,
                        {
                            role: "assistant",
                            data_type: "text",
                            content: successText,
                        },
                        { headers: { Authorization: `Bearer ${token}` } }
                    );

                    successMessage = {
                        id: response.data.response.assistant_message.id.toString(),
                        text: response.data.response.assistant_message.content
                            .data.message,
                        sender: "bot",
                        timestamp:
                            response.data.response.assistant_message.timestamp,
                    };

                    await axios.delete(
                        `${Config.API_BASE_URL}/api/v1/user/message/${confirmationContext.id}`,
                        { headers: { Authorization: `Bearer ${token}` } }
                    );
                    if (successMessage !== null) {
                        setMessages((prev) => [...prev, successMessage]);
                    }
                    removeConfirmationMessage(confirmationContext.id);
                    setConfirmationContext(null);
                    showSuccess(`Đã xóa ${count} mục`);
                }
            }
            if (confirmationContext.request_type === "query_expenses") {
                const filterParams = {
                    startDate: confirmationContext.data.start_date || "",
                    endDate: confirmationContext.data.end_date || "",
                    minAmount: confirmationContext.data.min_amount || "",
                    maxAmount: confirmationContext.data.max_amount || "",
                    keyword: confirmationContext.data.key_words[0] || "",
                    sortField: "expense_date",
                    sortOrder: "desc",
                };

                response = await axios.get(
                    `${Config.API_BASE_URL}/api/v1/user/expenses?page=1&pageSize=10&startDate=${filterParams.startDate}&endDate=${filterParams.endDate}&minAmount=${filterParams.minAmount}&maxAmount=${filterParams.maxAmount}&keyword=${filterParams.keyword}&sortField=${filterParams.sortField}&sortOrder=${filterParams.sortOrder}`,
                    {
                        headers: { Authorization: `Bearer ${token}` },
                    }
                );
                const resultMessage: Message = {
                    id: `msg_${Date.now()}`,
                    sender: "bot",
                    text: `Tìm thấy ${response.data.total_records} kết quả.`,
                    timestamp: new Date().toISOString(),
                    queryData: {
                        expenses: response.data.expenses,
                        page: response.data.page,
                        totalPages: response.data.total_pages,
                        totalRecords: response.data.total_records,
                        originalQuery: filterParams,
                    },
                };
                await axios.delete(
                    `${Config.API_BASE_URL}/api/v1/user/message/${confirmationContext.id}`,
                    { headers: { Authorization: `Bearer ${token}` } }
                );
                setMessages((prev) => [...prev, resultMessage]);
                removeConfirmationMessage(confirmationContext.id);
                setConfirmationContext(null);
            }
            setIsBotTyping(false);
        } catch (error) {
            handleApiError(
                error,
                "Lỗi khi thực hiện hành động. Vui lòng thử lại."
            );
        }
    };

    const handleBotResponse = async (apiResponse: any) => {
        const content = apiResponse.content;
        if (!content || !content.data) {
            return;
        }
        let newBotMessage: Message;
        const timestamp = apiResponse.timestamp || new Date().toISOString();

        if (content.type === "message") {
            setConfirmationContext(null);
        }

        switch (content.type) {
            case "message":
                newBotMessage = {
                    id: apiResponse.id.toString(),
                    text: content.data.message,
                    sender: "bot",
                    timestamp: timestamp,
                };
                break;

            case "comfirmation_request":
                let data = content.data.data;
                if (content.request_type === "insert_expenses") {
                    if (!data.expenses) {
                        data.expenses = [];
                    }
                    data.expenses = data.expenses.map((expense: any) => ({
                        ...expense,
                        submit: true,
                    }));
                }

                if (content.request_type === "update_expenses") {
                    try {
                        const token = await AsyncStorage.getItem("token");
                        const expenseId = content.data.data.id;

                        const orgResponse = await axios.get(
                            `${Config.API_BASE_URL}/api/v1/user/expenses/${expenseId}`,
                            { headers: { Authorization: `Bearer ${token}` } }
                        );

                        const originalExpense = orgResponse.data.expense;

                        data = {
                            ...data,
                            originalExpense: {
                                description: originalExpense.description,
                                amount: originalExpense.amount,
                                expense_date:
                                    originalExpense.expense_date.split("T")[0],
                            },
                        };
                    } catch (error) {
                        handleApiError(
                            error,
                            "Không thể tải thông tin khoản chi tiêu cũ"
                        );
                        return;
                    }
                }

                if (content.request_type === "delete_expenses") {
                    if (!data) {
                        data = [];
                    }
                    data = data.map((expense: any) => ({
                        ...expense,
                        submit: true,
                    }));
                }

                setConfirmationContext({
                    id: apiResponse.id.toString(),
                    request_type: content.request_type,
                    data: data,
                });
                newBotMessage = {
                    id: apiResponse.id.toString(),
                    text: content.data.message,
                    sender: "bot",
                    confirmationData: {
                        request_type: content.request_type,
                        data: data,
                    },
                    timestamp: timestamp,
                };

                if (content.request_type === "query_expenses") {
                    //
                }
                break;
            default:
                newBotMessage = {
                    id: Date.now().toString(),
                    text: `[Lỗi] Không thể hiểu loại tin nhắn: ${content.type}`,
                    sender: "bot",
                    timestamp: timestamp,
                };
        }
        if (newBotMessage) {
            setMessages((prev) => [...prev, newBotMessage]);
            setPendingScrollToEnd(true);
        }
    };

    const handleFetchResultPage = async (message: Message, newPage: number) => {
        setIsBotTyping(true);
        try {
            const token = await AsyncStorage.getItem("token");
            const filterParams = message.queryData?.originalQuery;
            const response = await axios.get(
                `${Config.API_BASE_URL}/api/v1/user/expenses?page=${newPage}&pageSize=10&startDate=${filterParams.startDate}&endDate=${filterParams.endDate}&minAmount=${filterParams.minAmount}&maxAmount=${filterParams.maxAmount}&keyword=${filterParams.keyword}&sortField=${filterParams.sortField}&sortOrder=${filterParams.sortOrder}`,
                { headers: { Authorization: `Bearer ${token}` } }
            );

            const newResultData = {
                expenses: response.data.expenses,
                page: response.data.page,
                totalPages: response.data.total_pages,
                totalRecords: response.data.total_records,
                originalQuery: filterParams,
            };

            setMessages((prevMessages) =>
                prevMessages.map((msg) => {
                    if (msg.id === message.id && msg.queryData) {
                        return {
                            ...msg,
                            text: `Tìm thấy ${newResultData.totalRecords} kết quả (Trang ${newResultData.page}/${newResultData.totalPages}).`,
                            queryData: newResultData,
                        };
                    }
                    return msg;
                })
            );
        } catch (error) {
            handleApiError(error, "Lỗi khi tải trang mới.");
        } finally {
            setIsBotTyping(false);
        }
    };

    const pickImage = async () => {
        const { status } =
            await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== "granted") {
            showError("Bạn cần cấp quyền truy cập thư viện ảnh!");
            return;
        }

        let result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: "images",
            quality: 0.7,
        });

        const tempId = Date.now().toString();

        if (!result.canceled) {
            const uri = result.assets[0].uri;
            const newMessage: Message = {
                id: tempId,
                image: uri,
                sender: "user",
                timestamp: new Date().toISOString(),
            };
            setMessages((prev) => [...prev, newMessage]);
            setPendingScrollToEnd(true);
            setIsBotTyping(true);
            const formData = new FormData();
            formData.append("role", "user");
            formData.append("data_type", "image");
            const fileName = uri.split("/").pop();
            const match = /\.(\w+)$/.exec(fileName!);
            const type = match ? `image/${match[1]}` : `image`;
            // @ts-ignore
            formData.append("file", { uri, name: fileName, type });
            try {
                const token = await AsyncStorage.getItem("token");
                const response = await axios.post(
                    `${Config.API_BASE_URL}/api/v1/user/message`,
                    formData,
                    {
                        headers: {
                            Authorization: `Bearer ${token}`,
                            "Content-Type": "multipart/form-data",
                        },
                    }
                );
                handleBotResponse(response.data.response.assistant_message);
                setPendingScrollToEnd(true);
            } catch (error) {
                handleApiError(error, "Lỗi khi gửi hình ảnh");
                setMessages((prev) => prev.filter((msg) => msg.id !== tempId));
            } finally {
                setIsBotTyping(false);
            }
        }
    };

    const sendMessage = async () => {
        const trimmedInput = input.trim();
        if (!trimmedInput) return;

        const tempId = Date.now().toString();

        const newMessage: Message = {
            id: tempId,
            text: trimmedInput,
            sender: "user",
            timestamp: new Date().toISOString(),
        };

        setMessages((prev) => [...prev, newMessage]);
        setPendingScrollToEnd(true);
        setInput("");
        setIsBotTyping(true);

        const body = {
            role: "user",
            data_type: "text",
            content: trimmedInput,
        };

        try {
            const token = await AsyncStorage.getItem("token");
            const response = await axios.post(
                `${Config.API_BASE_URL}/api/v1/user/message`,
                body,
                {
                    headers: {
                        Authorization: `Bearer ${token}`,
                    },
                }
            );

            const responseData = response.data;

            const serverUserMessage = responseData?.response?.user_message;

            if (serverUserMessage && serverUserMessage.id) {
                setMessages((prev) =>
                    prev.map((msg) =>
                        msg.id === tempId
                            ? {
                                  ...msg,
                                  id: serverUserMessage.id.toString(),
                                  timestamp: serverUserMessage.timestamp,
                              }
                            : msg
                    )
                );
            }
            handleBotResponse(responseData.response.assistant_message);
            setPendingScrollToEnd(true);
        } catch (error) {
            handleApiError(error, "Lỗi khi gửi tin nhắn");
            setMessages((prev) => prev.filter((msg) => msg.id !== tempId));
        } finally {
            setIsBotTyping(false);
        }
    };

    const renderMessage = ({ item }: { item: Message }) => {
        const isUser = item.sender === "user";

        if (item.queryData) {
            return (
                <QueryResultBubble
                    item={item}
                    formatTimestamp={formatTimestamp}
                    onFetchPage={handleFetchResultPage}
                />
            );
        }

        if (!item.confirmationData) {
            return (
                <StandardMessageBubble
                    item={item}
                    isUser={isUser}
                    formatTimestamp={formatTimestamp}
                />
            );
        } else if (confirmationContext) {
            return (
                <ConfirmationBubble
                    item={item}
                    context={confirmationContext}
                    formatTimestamp={formatTimestamp}
                    onConfirm={handleConfirmConfirmation}
                    onCancel={handleCancelConfirmation}
                    onInsertDataChange={handleConfirmationInsertDataChange}
                    onUpdateDataChange={handleConfirmationUpdateDataChange}
                    onDeleteDataChange={handleConfirmationDeleteDataChange}
                    onQueryDataChange={handleConfirmationQueryDataChange}
                    onDateOpen={openDatePicker}
                />
            );
        }
        return (
            <StandardMessageBubble
                item={{ ...item, text: item.text || "Yêu cầu đã hết hạn." }}
                isUser={isUser}
                formatTimestamp={formatTimestamp}
            />
        );
    };

    const loadMessage = async () => {
        try {
            if (messages.length === 0) setIsInitialLoading(true);
            else setIsLoadingOlder(true);

            const token = await AsyncStorage.getItem("token");
            const response = await axios.get(
                `${Config.API_BASE_URL}/api/v1/user/message`,
                {
                    headers: { Authorization: `Bearer ${token}` },
                    params: {
                        limit: 20,
                    },
                }
            );

            // XỬ LÝ MESSAGE HISTORY

            const loadedMessages: Message[] = [];
            const rawMessages = response.data.messages;

            for (const item of rawMessages) {
                if (!item || !item.content) continue;

                let message: Message | null = null;

                if (item.role === "user") {
                    if (item.content.type === "image_url") {
                        message = {
                            id: item.id.toString(),
                            image: item.content.data,
                            sender: "user",
                            timestamp: item.timestamp,
                        };
                    } else {
                        message = {
                            id: item.id.toString(),
                            text: item.content.message,
                            sender: "user",
                            timestamp: item.timestamp,
                        };
                    }
                } else {
                    if (item.content.type === "message") {
                        message = {
                            id: item.id.toString(),
                            text: item.content.data.message,
                            sender: "bot",
                            timestamp: item.timestamp,
                        };
                    } else if (item.content.type === "comfirmation_request") {
                        let data = item.content.data.data;

                        if (item.content.request_type === "insert_expenses") {
                            if (!data.expenses) {
                                data.expenses = [];
                            }
                            data.expenses = data.expenses.map(
                                (expense: any) => ({
                                    ...expense,
                                    submit: true,
                                })
                            );
                        } else if (
                            item.content.request_type === "update_expenses"
                        ) {
                            try {
                                const expenseId = data.id;

                                const orgResponse = await axios.get(
                                    `${Config.API_BASE_URL}/api/v1/user/expenses/${expenseId}`,
                                    {
                                        headers: {
                                            Authorization: `Bearer ${token}`,
                                        },
                                    }
                                );

                                const originalExpense =
                                    orgResponse.data.expense;
                                data = {
                                    ...data,
                                    originalExpense: {
                                        description:
                                            originalExpense.description,
                                        amount: originalExpense.amount,
                                        expense_date:
                                            originalExpense.expense_date.split(
                                                "T"
                                            )[0],
                                    },
                                };
                            } catch (error) {
                                console.error(
                                    "Lỗi khi tải originalExpense cho lịch sử:",
                                    item.id,
                                    error
                                );
                            }
                        } else if (
                            item.content.request_type === "delete_expenses"
                        ) {
                            if (Array.isArray(data)) {
                                data = data.map((expense: any) => ({
                                    ...expense,
                                    submit: true,
                                }));
                            } else {
                                console.warn(
                                    "delete_expenses history data is not an array:",
                                    data
                                );
                                data = [];
                            }
                        }
                        message = {
                            id: item.id.toString(),
                            text: item.content.data.message,
                            sender: "bot",
                            timestamp: item.timestamp,
                            confirmationData: {
                                request_type: item.content.request_type,
                                data: data,
                            },
                        };
                    }
                }

                if (message) {
                    loadedMessages.push(message);
                }
            }
            const finalMessages = loadedMessages.reverse();
            setMessages(finalMessages);

            if (finalMessages.length > 0) {
                const lastMessage = finalMessages[finalMessages.length - 1];
                if (
                    lastMessage.sender === "bot" &&
                    lastMessage.confirmationData
                ) {
                    setConfirmationContext({
                        id: lastMessage.id,
                        request_type: lastMessage.confirmationData.request_type,
                        data: lastMessage.confirmationData.data,
                    });
                }
            }

            setPendingScrollToEnd(true);
        } catch (error) {
            handleApiError(error, "Lỗi khi tải lịch sử tin nhắn.");
        } finally {
            setIsInitialLoading(false);
        }
    };

    const loadOlderMessages = async () => {
        if (isRefreshing) return;

        if (messages.length === 0) {
            loadMessage();
        }

        setIsRefreshing(true);
        setIsLoadingOlder(true);

        try {
            const oldestMessage = messages[0];
            const token = await AsyncStorage.getItem("token");

            const response = await axios.get(
                `${Config.API_BASE_URL}/api/v1/user/message`,
                {
                    headers: { Authorization: `Bearer ${token}` },
                    params: {
                        before_id: oldestMessage.id,
                        limit: 20,
                    },
                }
            );

            const rawMessages: any[] = response.data.messages;

            if (rawMessages && rawMessages.length > 0) {
                const olderMessages: Message[] = rawMessages
                    .map((item: any): Message | null => {
                        if (!item || !item.content) return null;

                        if (item.role === "user") {
                            if (item.content.type === "image_url") {
                                return {
                                    id: item.id.toString(),
                                    image: item.content.data,
                                    sender: "user",
                                    timestamp: item.timestamp,
                                };
                            } else {
                                return {
                                    id: item.id.toString(),
                                    text: item.content.message,
                                    sender: "user",
                                    timestamp: item.timestamp,
                                };
                            }
                        } else {
                            if (item.content.type === "message") {
                                return {
                                    id: item.id.toString(),
                                    text: item.content.data.message,
                                    sender: "bot",
                                    timestamp: item.timestamp,
                                };
                            }
                        }
                        return null;
                    })
                    .filter((msg): msg is Message => msg !== null);

                setMessages((prev) => [...olderMessages.reverse(), ...prev]);
                setPendingScrollToEnd(false);
            }
        } catch (error) {
            handleApiError(error, "Không thể tải tin nhắn cũ hơn");
        } finally {
            setIsRefreshing(false);
        }
    };

    const renderListFooter = () => {
        if (isBotTyping && !confirmationContext) {
            return (
                <View
                    style={[
                        styles.messageContainer,
                        styles.botMessage,
                        styles.typingContainer,
                    ]}
                >
                    <ActivityIndicator size="small" color="#000" />
                </View>
            );
        }
        return null;
    };

    useEffect(() => {
        loadMessage();
    }, []);

    useEffect(() => {
        if (messages.length === 0) return;

        const timeoutId = setTimeout(() => {
            if (pendingScrollToEnd) {
                flatListRef.current?.scrollToEnd({ animated: true });
                setPendingScrollToEnd(false);
                if (isLoadingOlder) setIsLoadingOlder(false);
            } else if (isLoadingOlder) {
                setIsLoadingOlder(false);
            }
        }, 100);

        return () => clearTimeout(timeoutId);
    }, [messages.length, isLoadingOlder, pendingScrollToEnd]);

    return (
        <SafeAreaProvider>
            <SafeAreaView style={styles.container}>
                {showDatePicker && (
                    <DateTimePicker
                        value={currentDate}
                        mode="date"
                        display="default"
                        onChange={onDateChange}
                    />
                )}

                {isInitialLoading ? (
                    <View style={styles.loadingContainer}>
                        <ActivityIndicator size="large" color="#0078ff" />
                    </View>
                ) : (
                    <KeyboardAvoidingView
                        style={styles.container}
                        behavior="padding"
                        keyboardVerticalOffset={135}
                    >
                        <FlatList
                            ref={flatListRef}
                            data={messages}
                            renderItem={renderMessage}
                            keyExtractor={(item) => item.id}
                            contentContainerStyle={styles.chatContainer}
                            showsVerticalScrollIndicator={false}
                            ListFooterComponent={renderListFooter}
                            extraData={confirmationContext}
                            onRefresh={loadOlderMessages}
                            refreshing={isRefreshing}
                        />

                        {!confirmationContext && (
                            <View style={styles.inputContainer}>
                                <TouchableOpacity
                                    style={styles.iconButton}
                                    onPress={pickImage}
                                >
                                    <Ionicons
                                        name="image-outline"
                                        size={24}
                                        color="#555"
                                    />
                                </TouchableOpacity>
                                <TextInput
                                    style={styles.input}
                                    placeholder="Nhập tin nhắn..."
                                    placeholderTextColor="#aaa"
                                    value={input}
                                    onChangeText={setInput}
                                    multiline
                                    onSubmitEditing={sendMessage}
                                />
                                <TouchableOpacity
                                    style={styles.sendButton}
                                    onPress={sendMessage}
                                    disabled={!input.trim()}
                                >
                                    <Ionicons
                                        name="send"
                                        size={22}
                                        color={!input.trim() ? "#aaa" : "#fff"}
                                    />
                                </TouchableOpacity>
                            </View>
                        )}
                    </KeyboardAvoidingView>
                )}

                <CustomToast
                    isVisible={toast.isVisible}
                    message={toast.message}
                    type={toast.type}
                    onHide={() => setToast({ ...toast, isVisible: false })}
                />
            </SafeAreaView>
        </SafeAreaProvider>
    );
}

const { width } = Dimensions.get("window");
const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: "#fff" },
    loadingContainer: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
    },
    chatContainer: { padding: 16, paddingBottom: 20 },

    inputContainer: {
        flexDirection: "row",
        alignItems: "flex-end",
        padding: 10,
        backgroundColor: "#fff",
        borderTopWidth: 1,
        borderTopColor: "#ddd",
    },
    input: {
        flex: 1,
        borderRadius: 24,
        backgroundColor: "#f0f0f0",
        paddingHorizontal: 16,
        paddingVertical: 10,
        paddingTop: 10,
        maxHeight: 100,
        fontSize: 16,
        marginHorizontal: 8,
    },
    sendButton: {
        backgroundColor: "#0078ff",
        borderRadius: 24,
        width: 44,
        height: 44,
        justifyContent: "center",
        alignItems: "center",
    },
    iconButton: {
        width: 44,
        height: 44,
        justifyContent: "center",
        alignItems: "center",
    },

    typingContainer: {
        width: 70,
        height: 40,
        justifyContent: "center",
        alignItems: "center",
        paddingVertical: 0,
        paddingHorizontal: 0,
        alignSelf: "flex-start",
        backgroundColor: "#e5e5ea",
        borderRadius: 16,
        borderBottomLeftRadius: 4,
        maxWidth: width * 0.75,
    },
    messageContainer: {
        maxWidth: width * 0.75,
        borderRadius: 16,
        paddingVertical: 10,
        paddingHorizontal: 14,
    },
    botMessage: {
        backgroundColor: "#e5e5ea",
        borderBottomLeftRadius: 4,
    },
});
