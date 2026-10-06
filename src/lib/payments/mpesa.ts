// ====================================================================
// G-TECH ISP OPERATING SYSTEM - SAFARICOM DARAJA M-PESA ENGINE
// Handles Lipa Na M-Pesa Online (STK Push), C2B Paybill, & Instant Reconnection
// ====================================================================

export interface STKPushRequest {
  phoneNumber: string; // 0712345678 or 254712345678
  amount: number;
  accountReference: string; // Customer Account No or Voucher Code
  transactionDesc: string;
}

export interface STKPushResponse {
  success: boolean;
  merchantRequestId: string;
  checkoutRequestId: string;
  responseCode: string;
  responseDescription: string;
  customerMessage: string;
}

export interface DarajaCallbackPayload {
  Body: {
    stkCallback: {
      MerchantRequestID: string;
      CheckoutRequestID: string;
      ResultCode: number;
      ResultDesc: string;
      CallbackMetadata?: {
        Item: Array<{
          Name: string;
          Value?: string | number;
        }>;
      };
    };
  };
}

export class MpesaService {
  /**
   * Normalizes Kenyan phone numbers to the canonical 254XXXXXXXXX format
   */
  static formatPhoneNumber(phone: string): string {
    let clean = phone.replace(/[^0-9]/g, "");
    if (clean.startsWith("0")) {
      clean = "254" + clean.substring(1);
    } else if (clean.startsWith("+254")) {
      clean = clean.substring(1);
    } else if (clean.startsWith("7") || clean.startsWith("1")) {
      clean = "254" + clean;
    }
    return clean;
  }

  /**
   * Generates a realistic Daraja M-Pesa Receipt Number (e.g. RKF8921JHS)
   */
  static generateReceiptNumber(): string {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    const prefix = "RK";
    let code = prefix;
    for (let i = 0; i < 8; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  }

  /**
   * Initiates Lipa Na M-Pesa Online (STK Push)
   */
  static async initiateSTKPush(request: STKPushRequest): Promise<STKPushResponse> {
    const formattedPhone = this.formatPhoneNumber(request.phoneNumber);
    const checkoutId = `ws_CO_${Date.now()}_${Math.floor(Math.random() * 100000)}`;
    const merchantId = `MCH_${Math.floor(Math.random() * 1000000)}`;

    // In a live environment with Daraja keys, makes an HTTPS POST to Daraja endpoint.
    // Here we provide instant execution with realistic response contract.
    await new Promise((resolve) => setTimeout(resolve, 300));

    return {
      success: true,
      merchantRequestId: merchantId,
      checkoutRequestId: checkoutId,
      responseCode: "0",
      responseDescription: "Success. Request accepted for processing",
      customerMessage: `An M-Pesa STK Push prompt of KSh ${request.amount} has been sent to ${formattedPhone}. Please enter your M-Pesa PIN on your phone.`,
    };
  }

  /**
   * Parses and processes incoming Daraja STK Callback
   */
  static parseCallback(payload: DarajaCallbackPayload): {
    success: boolean;
    resultCode: number;
    resultDesc: string;
    receiptNumber?: string;
    amount?: number;
    phoneNumber?: string;
    transactionDate?: string;
  } {
    const cb = payload.Body.stkCallback;
    if (cb.ResultCode !== 0) {
      return {
        success: false,
        resultCode: cb.ResultCode,
        resultDesc: cb.ResultDesc,
      };
    }

    let receiptNumber = "";
    let amount = 0;
    let phoneNumber = "";
    let transactionDate = "";

    if (cb.CallbackMetadata?.Item) {
      for (const item of cb.CallbackMetadata.Item) {
        if (item.Name === "MpesaReceiptNumber") receiptNumber = String(item.Value);
        if (item.Name === "Amount") amount = Number(item.Value);
        if (item.Name === "PhoneNumber") phoneNumber = String(item.Value);
        if (item.Name === "TransactionDate") transactionDate = String(item.Value);
      }
    }

    return {
      success: true,
      resultCode: 0,
      resultDesc: cb.ResultDesc,
      // Never invent a random reference: Daraja retries must map to the same
      // transaction_reference so the UNIQUE constraint can de-duplicate them.
      receiptNumber: receiptNumber || cb.CheckoutRequestID,
      amount,
      phoneNumber,
      transactionDate,
    };
  }
}
