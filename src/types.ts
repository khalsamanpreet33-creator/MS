export interface Client {
  id: string;
  name: string;
  company: string;
  mobile: string;
  gst: string;
  email: string;
  balance: number;
  createdAt: string;
}

export interface Product {
  id: string;
  name: string;
  type: "Product" | "Service";
  hsn: string;
  rate: number;
  stock: number;
  createdAt: string;
}

export interface InvoiceItem {
  name: string;
  rate: number;
  qty: number;
  total: number;
}

export interface Invoice {
  id: string;
  invoiceNo: string;
  clientName: string;
  clientMobile: string;
  date: string;
  subTotal?: number;
  discount?: number;
  gstRate?: number;
  amount: number;
  status: "Paid" | "Unpaid" | "Partial";
  paymentMode: "UPI" | "Cash" | "Bank";
  items: InvoiceItem[];
  createdAt: string;
}

export interface CompanySettings {
  compName: string;
  compWeb: string;
  compAddr: string;
  compState: string;
  compCity: string;
  compGst: string;
  compPin: string;
  compPhone: string;
  compCountry: string;
  compEmail: string;
  compCurr: string;
  bankName: string;
  bankHolder: string;
  bankAccNo: string;
  bankIfsc: string;
  bankBranch: string;
  invoiceTerms: string;
  invoiceGreet: string;
  upiVpa: string;
  logoUrl?: string;
  signUrl?: string;
  qrUrl?: string;
}
