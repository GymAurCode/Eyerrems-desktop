import { useState, useCallback } from "react";
import { bookingApi, BookingCreatePayload, BookingDetail } from "../lib/bookingApi";
import { attachmentApi } from "../lib/attachmentApi";

export type TransactionStep =
  | "idle"
  | "checking_availability"
  | "creating"
  | "uploading"
  | "done"
  | "error";

interface UploadSlot {
  file: File;
  description?: string;
  status?: string;
}

interface CreateWithAttachmentsParams {
  payload: BookingCreatePayload;
  attachments?: UploadSlot[];
}

interface TransactionState {
  step: TransactionStep;
  error: string | null;
  booking: BookingDetail | null;
}

export function useBookingTransaction() {
  const [state, setState] = useState<TransactionState>({
    step: "idle",
    error: null,
    booking: null,
  });

  const reset = useCallback(() => {
    setState({ step: "idle", error: null, booking: null });
  }, []);

  const createWithAttachments = useCallback(
    async ({ payload, attachments }: CreateWithAttachmentsParams): Promise<BookingDetail> => {
      setState({ step: "checking_availability", error: null, booking: null });

      try {
        // 1. Check unit availability (skip if no unit_id)
        if (payload.unit_id) {
          const avail = await bookingApi.checkAvailability({ unit_id: payload.unit_id });
          if (!avail.available) {
            const err = "Selected unit is already booked. Choose another unit or free the existing booking.";
            setState({ step: "error", error: err, booking: null });
            throw new Error(err);
          }
        }

        // 2. Create booking
        setState((s) => ({ ...s, step: "creating" }));
        const booking = await bookingApi.create(payload);

        // 3. Upload attachments if any
        if (attachments && attachments.length > 0) {
          setState((s) => ({ ...s, step: "uploading" }));
          await Promise.allSettled(
            attachments.map((slot) =>
              attachmentApi.upload(
                "booking",
                booking.id,
                slot.file,
                slot.description ?? "",
                slot.status ?? "COMPLETED",
              ),
            ),
          );
        }

        setState({ step: "done", error: null, booking });
        return booking;
      } catch (err: any) {
        const msg = err?.message ?? err?.response?.data?.detail ?? "Transaction failed";
        setState({ step: "error", error: msg, booking: null });
        throw err;
      }
    },
    [],
  );

  return {
    ...state,
    reset,
    createWithAttachments,
    isBusy: state.step !== "idle" && state.step !== "done" && state.step !== "error",
  };
}
