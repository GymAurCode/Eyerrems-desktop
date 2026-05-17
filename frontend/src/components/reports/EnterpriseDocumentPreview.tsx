/**
 * EnterpriseDocumentPreview — A4-style live preview for document-type reports.
 *
 * Renders the Installment Plan and Booking Form reports as a professional
 * print-ready document in the browser before export.
 */
import React from "react";

// ── Shared helpers ────────────────────────────────────────────────────────────

function fmt(value: any): string {
  if (value === null || value === undefined || value === "") return "—";
  return String(value);
}

function fmtCur(value: any): string {
  if (value === null || value === undefined || value === "") return "—";
  const s = String(value).replace(/,/g, "").replace(/\$/g, "");
  const n = parseFloat(s);
  if (isNaN(n)) return String(value);
  return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// ── Shared layout primitives ──────────────────────────────────────────────────

function DocHeader({ companyName, title, subtitle }: {
  companyName: string; title: string; subtitle: string;
}) {
  return (
    <div style={{ marginBottom: 0 }}>
      <div style={{
        background: "#1e3a5f", color: "#fff",
        padding: "12px 20px 8px", textAlign: "center",
      }}>
        <div style={{ fontSize: 18, fontWeight: 700, letterSpacing: 0.5 }}>{companyName}</div>
      </div>
      <div style={{
        background: "#2e5090", color: "#dbeafe",
        padding: "6px 20px 8px", textAlign: "center",
      }}>
        <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: 1, marginBottom: 3 }}>{title}</div>
        <div style={{ fontSize: 10, opacity: 0.85 }}>{subtitle}</div>
      </div>
    </div>
  );
}

function SectionHeader({ title }: { title: string }) {
  return (
    <div style={{
      background: "#f0f7ff",
      borderLeft: "3px solid #3b82f6",
      padding: "5px 10px",
      marginTop: 14, marginBottom: 0,
      fontSize: 10, fontWeight: 700, color: "#1e3a5f",
      letterSpacing: 0.5,
    }}>
      {title}
    </div>
  );
}

function InfoGrid({ fields, cols = 3 }: {
  fields: [string, any][]; cols?: number;
}) {
  const rows: [string, any][][] = [];
  for (let i = 0; i < fields.length; i += cols) {
    rows.push(fields.slice(i, i + cols));
  }
  return (
    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 9 }}>
      <tbody>
        {rows.map((row, ri) => (
          <tr key={ri} style={{ background: ri % 2 === 0 ? "#fff" : "#f5f7fa" }}>
            {row.map(([lbl, val], ci) => (
              <td key={ci} style={{
                border: "0.5px solid #d0d7e3",
                padding: "5px 8px",
                width: `${100 / cols}%`,
                verticalAlign: "top",
              }}>
                <div style={{ fontSize: 7.5, color: "#6b7280", marginBottom: 2 }}>{lbl}</div>
                <div style={{ fontSize: 9, fontWeight: 600, color: "#111827" }}>{fmt(val)}</div>
              </td>
            ))}
            {/* Fill empty cells */}
            {Array.from({ length: cols - row.length }).map((_, i) => (
              <td key={`empty-${i}`} style={{ border: "0.5px solid #d0d7e3", padding: "5px 8px" }} />
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function SummaryCards({ cards }: {
  cards: { label: string; value: string; color?: string }[];
}) {
  const colorMap: Record<string, string> = {
    green: "#059669", red: "#dc2626", blue: "#1e3a5f",
    gold: "#d97706", mid: "#2e5090",
  };
  return (
    <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginTop: 6 }}>
      {cards.map((c, i) => (
        <div key={i} style={{
          flex: "1 1 calc(25% - 4px)", minWidth: 100,
          background: "#f0f7ff", border: "0.5px solid #d0d7e3",
          borderRadius: 4, padding: "6px 8px", textAlign: "center",
        }}>
          <div style={{ fontSize: 7.5, color: "#6b7280", marginBottom: 3 }}>{c.label}</div>
          <div style={{
            fontSize: 12, fontWeight: 700,
            color: colorMap[c.color || "blue"] || "#1e3a5f",
          }}>{c.value}</div>
        </div>
      ))}
    </div>
  );
}

// ── Status badge ──────────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: string }) {
  const s = (status || "").toUpperCase();
  const map: Record<string, { bg: string; color: string }> = {
    PAID:    { bg: "#d1fae5", color: "#059669" },
    OVERDUE: { bg: "#fee2e2", color: "#dc2626" },
    PARTIAL: { bg: "#dbeafe", color: "#2563eb" },
    PENDING: { bg: "#fef3c7", color: "#d97706" },
  };
  const style = map[s] || { bg: "#f3f4f6", color: "#6b7280" };
  return (
    <span style={{
      background: style.bg, color: style.color,
      padding: "1px 6px", borderRadius: 10,
      fontSize: 7.5, fontWeight: 700,
    }}>{s}</span>
  );
}

// ── Signature section ─────────────────────────────────────────────────────────
function SignatureSection({ sigs }: { sigs: { title: string; sub: string }[] }) {
  return (
    <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 8 }}>
      <tbody>
        <tr>
          {sigs.map((sig, i) => (
            <td key={i} style={{
              border: "0.5px solid #d0d7e3",
              background: "#f0f7ff",
              padding: "10px 8px",
              textAlign: "center",
              width: `${100 / sigs.length}%`,
            }}>
              <div style={{ fontSize: 8.5, fontWeight: 600, color: "#1e3a5f", marginBottom: 20 }}>{sig.title}</div>
              <div style={{ borderTop: "1px solid #9ca3af", marginBottom: 4 }} />
              <div style={{ fontSize: 7.5, color: "#6b7280" }}>{sig.sub}</div>
            </td>
          ))}
        </tr>
      </tbody>
    </table>
  );
}

// ── Declaration block ─────────────────────────────────────────────────────────
function Declaration({ text, terms }: { text: string; terms: string[] }) {
  return (
    <div style={{ fontSize: 8, color: "#374151", lineHeight: 1.5 }}>
      <p style={{ marginBottom: 6, textAlign: "justify" }}>{text}</p>
      {terms.map((t, i) => (
        <p key={i} style={{ marginBottom: 3, color: "#6b7280" }}>{t}</p>
      ))}
    </div>
  );
}

// ── INSTALLMENT PLAN PREVIEW ──────────────────────────────────────────────────

export function InstallmentPlanPreview({ data, companyName }: {
  data: Record<string, any>;
  companyName: string;
}) {
  const customer  = data.customer || {};
  const prop      = data.property || {};
  const plan      = data.plan || {};
  const rows      = data.installment_rows || [];
  const bookingId = data.booking_id || "";
  const meta      = data.meta || {};

  const totGross = rows.reduce((s: number, r: any) => s + (parseFloat(r.gross_amount) || 0), 0);
  const totDisc  = rows.reduce((s: number, r: any) => s + (parseFloat(r.discount) || 0), 0);
  const totNet   = rows.reduce((s: number, r: any) => s + (parseFloat(r.net_amount) || 0), 0);
  const totOut   = rows.reduce((s: number, r: any) => s + (parseFloat(r.outstanding) || 0), 0);

  return (
    <div style={{
      fontFamily: "Arial, Helvetica, sans-serif",
      fontSize: 9, color: "#111827",
      background: "#fff",
      maxWidth: 794, margin: "0 auto",
      boxShadow: "0 2px 20px rgba(0,0,0,0.12)",
    }}>
      {/* Header */}
      <DocHeader
        companyName={companyName}
        title="INSTALLMENT PLAN REPORT"
        subtitle={`Booking No: ${bookingId}  |  Date: ${meta.generated_at || ""}  |  Ref: ${meta.report_id || ""}`}
      />

      <div style={{ padding: "0 16px 16px" }}>

        {/* Customer Details */}
        <SectionHeader title="CUSTOMER DETAILS" />
        <InfoGrid fields={[
          ["Customer Name",    customer.name],
          ["Father / Husband", customer.father_name],
          ["CNIC",             customer.cnic],
          ["Phone",            customer.phone],
          ["WhatsApp",         customer.whatsapp],
          ["Email",            customer.email],
          ["Address",          customer.address],
          ["Country",          customer.country || "Pakistan"],
          ["Registration No.", customer.registration_no],
          ["Booking Date",     customer.booking_date],
          ["Status",           customer.status],
          ["Client ID",        customer.client_id],
        ]} cols={3} />

        {/* Property Details */}
        <SectionHeader title="PROPERTY DETAILS" />
        <InfoGrid fields={[
          ["Project Name",       prop.project_name],
          ["Unit Number",        prop.unit_number],
          ["Floor",              prop.floor],
          ["Property Type",      prop.property_type],
          ["Category",           prop.category],
          ["Area / Size",        prop.size],
          ["Rate Per Sqft",      prop.rate_per_sqft],
          ["Gross Price",        prop.gross_price],
          ["Discount",           prop.discount],
          ["Net Price",          prop.net_price],
          ["Processing Fee",     prop.processing_fee],
          ["Possession Charges", prop.possession_charges],
        ]} cols={3} />

        {/* Plan Summary */}
        <SectionHeader title="PAYMENT PLAN SUMMARY" />
        <SummaryCards cards={[
          { label: "Down Payment",        value: plan.down_payment || "—",   color: "green" },
          { label: "Total Installments",  value: String(plan.total_count || "—"), color: "blue" },
          { label: "Monthly Installment", value: plan.amount_per || "—",     color: "mid" },
          { label: "Total Payable",       value: plan.total_amount || "—",   color: "blue" },
        ]} />
        <SummaryCards cards={[
          { label: "Half Yearly",  value: plan.half_yearly || "—",  color: "mid" },
          { label: "Last Payment", value: plan.last_payment || "—", color: "gold" },
          { label: "Outstanding",  value: plan.outstanding || "—",  color: "red" },
          { label: "Frequency",    value: plan.frequency || "—",    color: "blue" },
        ]} />

        {/* Installment Table */}
        <SectionHeader title="INSTALLMENT SCHEDULE" />
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 8, marginTop: 4 }}>
          <thead>
            <tr style={{ background: "#1e3a5f", color: "#fff" }}>
              {["Sr#", "Description", "Inst#", "Due Date", "Gross Amt", "Discount", "Net Amount", "Outstanding", "Status"].map((h, i) => (
                <th key={i} style={{
                  padding: "5px 5px", textAlign: i >= 4 && i <= 7 ? "right" : "center",
                  fontWeight: 700, fontSize: 7.5, border: "0.5px solid #1e3a5f",
                  whiteSpace: "nowrap",
                }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row: any, ri: number) => (
              <tr key={ri} style={{ background: ri % 2 === 0 ? "#fff" : "#f5f7fa" }}>
                <td style={{ padding: "4px 5px", textAlign: "center", border: "0.5px solid #d0d7e3" }}>{row.sr_no}</td>
                <td style={{ padding: "4px 5px", border: "0.5px solid #d0d7e3" }}>{row.description}</td>
                <td style={{ padding: "4px 5px", textAlign: "center", border: "0.5px solid #d0d7e3" }}>{row.inst_no || "—"}</td>
                <td style={{ padding: "4px 5px", textAlign: "center", border: "0.5px solid #d0d7e3" }}>{row.due_date}</td>
                <td style={{ padding: "4px 5px", textAlign: "right", border: "0.5px solid #d0d7e3", fontFamily: "monospace" }}>{fmtCur(row.gross_amount)}</td>
                <td style={{ padding: "4px 5px", textAlign: "right", border: "0.5px solid #d0d7e3", fontFamily: "monospace" }}>{fmtCur(row.discount)}</td>
                <td style={{ padding: "4px 5px", textAlign: "right", border: "0.5px solid #d0d7e3", fontFamily: "monospace" }}>{fmtCur(row.net_amount)}</td>
                <td style={{ padding: "4px 5px", textAlign: "right", border: "0.5px solid #d0d7e3", fontFamily: "monospace" }}>{fmtCur(row.outstanding)}</td>
                <td style={{ padding: "4px 5px", textAlign: "center", border: "0.5px solid #d0d7e3" }}>
                  <StatusBadge status={row.status} />
                </td>
              </tr>
            ))}
            {/* Totals row */}
            <tr style={{ background: "#dbeafe", fontWeight: 700 }}>
              <td style={{ padding: "5px 5px", border: "0.5px solid #b0c4de" }} />
              <td style={{ padding: "5px 5px", border: "0.5px solid #b0c4de", fontSize: 9, color: "#1e3a5f" }}>TOTAL</td>
              <td style={{ padding: "5px 5px", border: "0.5px solid #b0c4de" }} />
              <td style={{ padding: "5px 5px", border: "0.5px solid #b0c4de" }} />
              <td style={{ padding: "5px 5px", textAlign: "right", border: "0.5px solid #b0c4de", fontFamily: "monospace", color: "#1e3a5f" }}>{fmtCur(totGross)}</td>
              <td style={{ padding: "5px 5px", textAlign: "right", border: "0.5px solid #b0c4de", fontFamily: "monospace", color: "#1e3a5f" }}>{fmtCur(totDisc)}</td>
              <td style={{ padding: "5px 5px", textAlign: "right", border: "0.5px solid #b0c4de", fontFamily: "monospace", color: "#1e3a5f" }}>{fmtCur(totNet)}</td>
              <td style={{ padding: "5px 5px", textAlign: "right", border: "0.5px solid #b0c4de", fontFamily: "monospace", color: "#dc2626" }}>{fmtCur(totOut)}</td>
              <td style={{ padding: "5px 5px", border: "0.5px solid #b0c4de" }} />
            </tr>
          </tbody>
        </table>

        {/* Declaration */}
        <SectionHeader title="DECLARATION & AGREEMENT" />
        <div style={{ padding: "8px 0" }}>
          <Declaration
            text="I/We hereby declare that the above information is correct and I/We agree to abide by the terms and conditions of the payment plan as outlined above. I/We understand that failure to make payments on the due dates may result in late payment charges and/or cancellation of the booking as per the company's cancellation policy."
            terms={[
              "1. Payments must be made on or before the due date mentioned in the schedule above.",
              "2. A grace period of 7 days is allowed; after which late payment surcharge will be applicable.",
              "3. Bounced cheques will attract a penalty as per company policy.",
              "4. The company reserves the right to cancel the booking in case of default.",
              "5. All disputes shall be subject to the jurisdiction of local courts.",
            ]}
          />
        </div>

        {/* Signatures */}
        <SignatureSection sigs={[
          { title: "Applicant Signature", sub: "Name & Date" },
          { title: "Applicant Thumb",     sub: "Left Thumb Impression" },
          { title: "Authorized Officer",  sub: "Name, Designation & Stamp" },
        ]} />

        {/* Footer */}
        <div style={{
          marginTop: 12, paddingTop: 6,
          borderTop: "0.5px solid #d0d7e3",
          fontSize: 7.5, color: "#9ca3af", textAlign: "center",
        }}>
          {companyName}  |  Installment Plan Report  |  {bookingId}  |  Confidential  |  {meta.generated_at || ""}
        </div>
      </div>
    </div>
  );
}

// ── BOOKING FORM PREVIEW ──────────────────────────────────────────────────────

export function BookingFormPreview({ data, companyName }: {
  data: Record<string, any>;
  companyName: string;
}) {
  const bookingInfo  = data.booking_info || {};
  const applicant    = data.applicant || {};
  const joint        = data.joint_applicant || {};
  const nominee      = data.nominee || {};
  const prop         = data.property || {};
  const plan         = data.payment_plan || {};
  const bookingId    = bookingInfo.booking_id || "";
  const meta         = data.meta || {};

  const hasJoint = Object.values(joint).some((v) => v);

  const defaultTerms = [
    "The booking is subject to availability and management approval.",
    "The booking amount is non-refundable in case of cancellation by the applicant.",
    "All payments must be made via crossed cheque or bank transfer in favor of the company.",
    "The company reserves the right to cancel the booking in case of non-payment.",
    "Possession will be handed over only after full payment of all dues.",
    "Any dispute shall be resolved as per the laws of Pakistan.",
    "The applicant confirms that all information provided is accurate and complete.",
    "The company is not responsible for any delay due to force majeure events.",
  ];

  return (
    <div style={{
      fontFamily: "Arial, Helvetica, sans-serif",
      fontSize: 9, color: "#111827",
      background: "#fff",
      maxWidth: 794, margin: "0 auto",
      boxShadow: "0 2px 20px rgba(0,0,0,0.12)",
    }}>
      {/* Header */}
      <DocHeader
        companyName={companyName}
        title="PROPERTY BOOKING FORM"
        subtitle={`Booking No: ${bookingId}  |  Date: ${meta.generated_at || ""}  |  Ref: ${meta.report_id || ""}`}
      />

      <div style={{ padding: "0 16px 16px" }}>

        {/* Booking Info */}
        <SectionHeader title="BOOKING INFORMATION" />
        <InfoGrid fields={[
          ["Booking Date",   bookingInfo.booking_date],
          ["Booking Number", bookingInfo.booking_id],
          ["Tracking ID",    bookingInfo.tracking_id],
          ["Booking Status", bookingInfo.status],
          ["Expiry Date",    bookingInfo.expiry_date],
          ["Booking Amount", bookingInfo.booking_amount],
        ]} cols={3} />

        {/* Applicant */}
        <SectionHeader title="APPLICANT INFORMATION" />
        <InfoGrid fields={[
          ["Full Name",    applicant.name],
          ["CNIC",         applicant.cnic],
          ["Date of Birth",applicant.dob],
          ["Passport No.", applicant.passport],
          ["Occupation",   applicant.occupation],
          ["Phone",        applicant.phone],
          ["WhatsApp",     applicant.whatsapp],
          ["Email",        applicant.email],
          ["Address",      applicant.address],
          ["Country",      applicant.country || "Pakistan"],
          ["Client ID",    applicant.client_id],
          ["Status",       applicant.status],
        ]} cols={3} />

        {/* Joint Applicant (conditional) */}
        {hasJoint && (
          <>
            <SectionHeader title="JOINT APPLICANT" />
            <InfoGrid fields={[
              ["Full Name", joint.name],
              ["CNIC",      joint.cnic],
              ["Relation",  joint.relation],
              ["Contact",   joint.contact],
              ["Email",     joint.email],
              ["Address",   joint.address],
            ]} cols={3} />
          </>
        )}

        {/* Nominee */}
        <SectionHeader title="NOMINEE INFORMATION" />
        <InfoGrid fields={[
          ["Nominee Name", nominee.name],
          ["Relation",     nominee.relation],
          ["CNIC",         nominee.cnic],
          ["Contact",      nominee.contact],
        ]} cols={4} />

        {/* Property */}
        <SectionHeader title="PROPERTY INFORMATION" />
        <InfoGrid fields={[
          ["Project",        prop.project_name],
          ["Unit Number",    prop.unit_number],
          ["Floor",          prop.floor],
          ["Property Type",  prop.property_type],
          ["Category",       prop.category],
          ["Size / Area",    prop.size],
          ["Rate Per Sqft",  prop.rate_per_sqft],
          ["Total Price",    prop.gross_price],
          ["Discount",       prop.discount],
          ["Net Price",      prop.net_price],
          ["Deal Valid Till",prop.deal_valid_till],
          ["Unit Status",    prop.unit_status],
        ]} cols={3} />

        {/* Payment Plan */}
        <SectionHeader title="PAYMENT PLAN SUMMARY" />
        <SummaryCards cards={[
          { label: "Down Payment",       value: plan.down_payment || "—",       color: "green" },
          { label: "Installments Count", value: String(plan.total_count || "—"), color: "blue" },
          { label: "Last Installment",   value: plan.last_installment || "—",   color: "gold" },
          { label: "Processing Charges", value: plan.processing_fee || "—",     color: "mid" },
        ]} />
        <SummaryCards cards={[
          { label: "Plan Start Date", value: plan.start_date || "—",    color: "blue" },
          { label: "Frequency",       value: plan.frequency || "—",     color: "mid" },
          { label: "Total Payable",   value: plan.total_amount || "—",  color: "blue" },
          { label: "Outstanding",     value: plan.outstanding || "—",   color: "red" },
        ]} />

        {/* Terms & Conditions */}
        <SectionHeader title="TERMS & CONDITIONS" />
        <div style={{ padding: "8px 0" }}>
          {defaultTerms.map((t, i) => (
            <p key={i} style={{ fontSize: 8, color: "#374151", marginBottom: 4, lineHeight: 1.5 }}>
              {i + 1}. {t}
            </p>
          ))}
        </div>

        {/* Signatures */}
        <SectionHeader title="SIGNATURES" />
        <SignatureSection sigs={[
          { title: "Applicant Signature", sub: "Name & Date" },
          { title: "Applicant Thumb",     sub: "Left Thumb Impression" },
          { title: "Booking Officer",     sub: "Name & Designation" },
          { title: "Manager Approval",    sub: "Name, Designation & Stamp" },
        ]} />

        {/* Footer */}
        <div style={{
          marginTop: 12, paddingTop: 6,
          borderTop: "0.5px solid #d0d7e3",
          fontSize: 7.5, color: "#9ca3af", textAlign: "center",
        }}>
          {companyName}  |  Property Booking Form  |  {bookingId}  |  Confidential  |  {meta.generated_at || ""}
        </div>
      </div>
    </div>
  );
}
