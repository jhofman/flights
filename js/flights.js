var flights;
var carriers = {};
var markets = {};

var colors = {"United Air Lines Inc.": "#0000A6",
	      "Virgin America": "#FF0000",
	      "Delta Air Lines Inc.": "#FF8C00",
	      "American Airlines Inc.": "#A60000",
	      "US Airways Inc.": "#242424",
	      "JetBlue Airways": "#0000e6",
	      "Frontier Airlines Inc.": "rgb(0,112,74)",
	      "Alaska Airlines Inc.": "rgb(18,45,81)",
	      "SkyWest Airlines Inc.": "rgb(0,82,155)",
	      "Southwest Airlines Co.": "rgb(255,192,39)"};

$(document).ready(main);
    
function main() {
    // Overrides the default autocomplete filter function to search only from the beginning of the string
    // http://stackoverflow.com/a/19053987
    $.ui.autocomplete.filter = function (array, term) {
	var matcher = new RegExp("^" + $.ui.autocomplete.escapeRegex(term), "i");
	return $.grep(array, function (value) {
            return matcher.test(value.label || value.value || value);
	});
    };

    // load csv files
    load_carriers();
    load_markets();
    load_flights();
}

// load counts of number of flights by (orig, dest, carrier)
// when loaded, allow input in orig/dest boxes
function load_flights() {
    $('#orig, #dest').prop('disabled', true);
    d3.csv("data/flights.csv", function(data) {
	flights = data;

	// set autocomplete for origin and destination
	// on changed value, run plot_num_flights function
	$('#orig, #dest').autocomplete({source: d3.keys(markets),
					select: function (event, ui) {
					    if(ui.item){
						$(event.target).val(ui.item.value);
						show_airports_and_plot();
					    }
					},
					change: show_airports_and_plot});

	// allow input on origin and destination
	$('#orig, #dest').prop('disabled', false);


	$('#orig').focus();

	// show outbound nyc flights by default
	/*
	$('#orig').val('New York City, NY (Metropolitan Area)');
	show_airports_and_plot();
	*/
    });
}

// load carriers to convert codes to airline names
function load_carriers() {
    d3.csv("data/carriers.csv", function(data) {
	$.each(data, function(i, carrier) {
	    carriers[carrier.Code] = carrier.Description.replace(/ \(.*\)$/, '');
	});
    });
}

// load mapping from market name to list of airports
function load_markets() {
    d3.csv("data/airports.csv", function(data) {
	$.each(data, function(i, airport) {
	    if (!(airport.origin_market in markets))
		markets[airport.origin_market] = {};
	    markets[airport.origin_market][airport.origin] = 1;
	});
	$.each(markets, function(market, airports) {
	    markets[market] = d3.keys(airports);
	});
    });
}

// adds checkboxes for airports and then calls plot_num_flights
function show_airports_and_plot() {
    // grab markets from input boxes
    var orig_market = $('#orig').val();
    var dest_market = $('#dest').val();

    // make sure origin is valid
    // destination is optional, check if given
    if (d3.keys(markets).indexOf(orig_market) < 0 || (dest_market.length > 0 && d3.keys(markets).indexOf(dest_market) < 0)) {
	return;
    }

    // add origin airports
    show_airport_list('#orig_airports', orig_market);

    // add destination airports
    if (dest_market.length > 0)
	show_airport_list('#dest_airports', dest_market);

    plot_num_flights();
}

// plot the number of flights from an origin market to an optional destination market
function plot_num_flights() {
    // limit flights checked airports only
    // if no destination given, add all outgoing flights by carrier
    var plot_data = {};
    $.each(flights, function(i, flight) {
	if ($('#orig_airports #' + flight.origin).is(':checked') && ($('#dest_airports').html() == '' || $('#dest_airports #' + flight.dest).is(':checked'))) {
	    carrier = carriers[flight.carrier];

	    if (carrier in plot_data)
		plot_data[carrier] += parseFloat(flight.num_flights);
	    else
		plot_data[carrier] = parseFloat(flight.num_flights);
	}
    });

    // convert this dictionary into an array of (key, value) pairs
    // sort by number of flights (value), descending
    plot_data = d3.entries(plot_data);
    plot_data.sort(function(a, b) {
	return b.value - a.value;
    });

    // set up svg canvas and x/y scales, axes
    var margin = {top: 20, right: 20, bottom: 20, left: 150};
    var width = Math.min(0.9*$(document).width(), 600) - margin.left - margin.right;
    //var height = 800 - margin.top - margin.bottom;
    var height = 30*plot_data.length - margin.top - margin.bottom;

    var x = d3.scale.linear()
	.range([0, width]);

    var y = d3.scale.ordinal()
	.rangeRoundBands([0, height], 0.25);

    var xAxis = d3.svg.axis()
	.scale(x)
	.orient("top")
	.ticks(10, "%");

    var yAxis = d3.svg.axis()
	.scale(y)
	.orient("left");

    // clear existing plot
    $('#plot').html('');

    // add svg element
    var svg = d3.select("#plot").append("svg")
	.attr("width", width + margin.left + margin.right)
	.attr("height", height + margin.top + margin.bottom)
	.append("g")
	.attr("transform", "translate(" + margin.left + "," + margin.top + ")");

    // determine domain for x and y axes
    x.domain([0, d3.max(plot_data, function(d) { return d.value; })]);
    y.domain(plot_data.map(function(d) { return d.key; }));

    // add x-axis labels
    svg.append("g")
	.attr("class", "x axis")
	.call(xAxis)
	.selectAll("text");

    // add y-axis labels
    svg.append("g")
	.attr("class", "y axis")
	.call(yAxis)
	.append("text")
	.attr("transform", "rotate(-90)")
	.attr("y", 6)
	.attr("dy", ".71em")
	.style("text-anchor", "end");

    // add bars
    svg.selectAll(".bar")
	.data(plot_data)
	.enter().append("rect")
	.attr("class", "bar")
	.attr('airline', function(d) { return d.key; })
	.attr("y", function(d) { return y(d.key); })
	.attr("height", y.rangeBand())
	.attr("x", 0)
	.attr("width", function(d) { return x(d.value); })
        .style("fill", function(d) {
	    if (d.key in colors)
		return colors[d.key];
	    else
		return "green";
	});

}

// adds checkboxes for airports in a given market to a div
function show_airport_list(div, market) {
    if ($(div).text().indexOf(market) >= 0)
	return;

    var span = "<span class=market id='" + market + "'>";
    span += "<a class=delete href=''>x</a>&nbsp;&nbsp;";
    span += "<span class=market_name id='" + market + "'>" + market + "</span><br/>";

    $.each(markets[market], function (i, airport) {
	span += '<input id=' + airport + ' type=checkbox checked=checked >' + airport + '</input> '
    });
    span += "<br/></span>";

    span = $(span);
    span.find('.delete').click(function () { $(this).parent().remove(); })

    $(div).append(span);
    $(div).click(plot_num_flights);
}