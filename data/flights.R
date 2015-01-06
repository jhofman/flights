library(plyr)
library(dplyr)

# read historical flight data from
# http://www.transtats.bts.gov/DL_SelectFields.asp?Table_ID=236&DB_Short_Name=On-Time
# with (at least) these headers
# "CARRIER","ORIGIN_AIRPORT_ID","ORIGIN_CITY_MARKET_ID","ORIGIN","DEST_AIRPORT_ID","DEST_CITY_MARKET_ID","DEST"
paths <- dir(".", pattern="201.*.csv", full.names=T)
flights <- ldply(paths, read.csv)
flights$X <- NULL
names(flights) <- tolower(names(flights))

# read airline information and limit to existing carriers
# http://www.transtats.bts.gov/Download_Lookup.asp?Lookup=L_CARRIER_HISTORY
carriers <- read.csv('carriers.csv')
carriers <- carriers %>%
  mutate(nc=nchar(as.character(Description)),
         ss=substring(as.character(Description),nc-3,nc)) %>%
  filter(ss==" - )") %>%
  select(Code, Description)
write.csv(carriers, file='current_carriers.csv', row.names=F)

# read market information and join to flights
# http://www.transtats.bts.gov/Download_Lookup.asp?Lookup=L_CITY_MARKET_ID
markets <- read.csv('markets.csv')
names(markets)=c("origin_city_market_id","origin_market")
flights <- left_join(flights, markets)
names(markets)=c("dest_city_market_id","dest_market")
flights <- left_join(flights, markets)

# extract airports in each market
airports <- flights %>%
  select(origin_airport_id, origin, origin_market, origin_city_market_id) %>%
  unique(.)
write.csv(airports, file='airports.csv', row.names=F)

# count average number of flights per day from each origin/dest pair, by carrier
num_days <- length(unique(flights$fl_date))
flights_by_airport <- flights %>%
  group_by(origin, dest, carrier) %>%
  summarize(num_flights=round(100*n() / num_days)/100)
write.csv(flights_by_airport, file='flights.csv', row.names=F)
