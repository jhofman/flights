var flights;
var carriers = {};
var markets = {};

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
    load_flights();
}

// load counts of number of flights by (orig, dest, carrier)
// when loaded, allow input in orig/dest boxes
function load_flights() {
    $('#orig, #dest').prop('disabled', true);
    d3.csv("data/flights.csv", function(data) {
	flights = data;

	// populate mapping from market name to list of airports
	// note: currently not used
	$.each(flights, function(i, flight) {
	    if (!(flight.origin_market in markets))
		markets[flight.origin_market] = {};
	    markets[flight.origin_market][flight.origin] = 1;
	});
	$.each(markets, function(market, airports) {
	    markets[market] = d3.keys(airports);
	});

	// set autocomplete for origin and destination
	// on changed value, run plot_num_flights function
	$('#orig, #dest').autocomplete({source: d3.keys(markets),
					change: show_airports_and_plot});

	// allow input on origin and destination
	$('#orig, #dest').prop('disabled', false);


	// show outbound nyc flights by default
	$('#orig').val('New York City, NY (Metropolitan Area)');
	show_airports_and_plot();
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
    // grab markets from input boxes
    var orig_market = $('#orig').val();
    var dest_market = $('#dest').val();

    // make sure origin is valid
    // destination is optional, check if given
    if (d3.keys(markets).indexOf(orig_market) < 0 || (dest_market.length > 0 && d3.keys(markets).indexOf(dest_market) < 0)) {
	return;
    }

    // limit flights for orig(/dest)
    // if no destination given, add all outgoing flights by carrier
    // divide num_flights by 60 hack b/c we have 2 months of data
    var plot_data = {};
    $.each(flights, function(i, flight) {
	if (flight.origin_market == orig_market && (!dest_market || flight.dest_market == dest_market)) {

	    if ($('#orig_airports #' + flight.origin).is(':checked') && (!dest_market || $('#dest_airports #' + flight.dest).is(':checked'))) {
		carrier = carriers[flight.carrier];
		
		if (carrier in plot_data)
		    plot_data[carrier] += parseFloat(flight.num_flights);
		else
		    plot_data[carrier] = parseFloat(flight.num_flights);
	    }
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
    var width = 600 - margin.left - margin.right;
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
	//.attr("transform", "translate(0," + height + ")")
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
	.attr("width", function(d) { return x(d.value); });
}

// adds checkboxes for airports in a given market to a div
function show_airport_list(div, market) {
    $(div).html('');
    $.each(markets[market], function (i, airport) {
	var el = $('<input id=' + airport + ' type=checkbox checked=checked >' + airport + '</input> ');
	$(div).append(el);
    });
    $(div).click(plot_num_flights);
}