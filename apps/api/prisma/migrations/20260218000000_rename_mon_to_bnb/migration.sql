-- Rename monAmountWei to bnbAmountWei in Payment table
ALTER TABLE "Payment" RENAME COLUMN "monAmountWei" TO "bnbAmountWei";
