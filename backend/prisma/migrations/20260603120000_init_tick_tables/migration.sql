-- CreateTable
CREATE TABLE "index_ticks" (
    "id" SERIAL NOT NULL,
    "index_id" TEXT NOT NULL,
    "time" BIGINT NOT NULL,
    "capital_value" DOUBLE PRECISION NOT NULL,
    "percentage_change_from_yesterday_close_value" DOUBLE PRECISION NOT NULL,
    "yesterday_close_value" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "index_ticks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_ticks" (
    "id" SERIAL NOT NULL,
    "trade_code" TEXT NOT NULL,
    "time" BIGINT NOT NULL,
    "close_price" DOUBLE PRECISION NOT NULL,
    "yesterday_close_price" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "stock_ticks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "index_ticks_index_id_time_idx" ON "index_ticks"("index_id", "time");

-- CreateIndex
CREATE INDEX "stock_ticks_trade_code_time_idx" ON "stock_ticks"("trade_code", "time");

