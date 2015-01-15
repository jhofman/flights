var flights;
var carriers = {};
var markets = {};
var airports = {};

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
    /*
    $.ui.autocomplete.filter = function (array, term) {
	var matcher = new RegExp("^" + $.ui.autocomplete.escapeRegex(term), "i");
	return $.grep(array, function (value) {
            return matcher.test(value.label || value.value || value);
	});
    };
    */

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


	$('#orig, #dest').tokenfield({
            autocomplete: {
		source: d3.keys(markets).concat(d3.keys(airports)),
		delay: 100
            },
            showAutocompleteOnFocus: false
	});

	$('#orig, #dest').on('tokenfield:createtoken', function (event) {
	    var new_token = event.attrs.value;
	    var existing_tokens = $(this).tokenfield('getTokens');

	    // prevent duplicates
	    $.each(existing_tokens, function(index, token) {
		if (token.value === new_token)
		    event.preventDefault();
	    });

	    // replace markets with all airports in them
            if (d3.keys(markets).indexOf(new_token) >= 0) {
		var tf = $(this);

		$.each(markets[new_token], function (i, airport) {
		    tf.tokenfield('createToken', {value: airport, label: airport});
		});
		event.preventDefault();
		// simpler way to clear typed text?
		$('#' + $(this).attr('id') + '-tokenfield').val('');
            }

	    // limit to allowed options (markets or airports)
	    var allowed_tokens = d3.keys(markets).concat(d3.keys(airports));
            if (allowed_tokens.indexOf(new_token) < 0) {
		event.preventDefault();
            }

	});
	$('#orig, #dest').change(plot_num_flights);


	// allow input on origin and destination
	$('#orig, #dest').prop('disabled', false);
	$('#orig, #dest').tokenfield('enable');

	$('#step_1').animate({opacity: 1}, 1000);
	$('#orig').focus();

	// show outbound nyc flights by default
	/*
	$('#orig').val('New York City, NY (Metropolitan Area)');
	plot_num_flights();
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
	    airports[airport.origin] = 1;
	});
	$.each(markets, function(market, airports) {
	    markets[market] = d3.keys(airports);
	});

	// include 3 letter metro codes
	markets["NYC"] = markets["New York City, NY (Metropolitan Area)"];
	markets["QDF"] = markets["Dallas/Fort Worth, TX"];
	markets["DTT"] = markets["Detroit, MI"];
	markets["QHO"] = markets["Houston, TX"];
	markets["QLA"] = markets["Los Angeles, CA (Metropolitan Area)"];
	markets["QMI"] = markets["Miami, FL (Metropolitan Area)"];;
	markets["QSF"] = markets["San Francisco, CA (Metropolitan Area)"];
    });
}

// plot the number of flights from an origin market to an optional destination market
function plot_num_flights() {
    var orig = $('#orig').tokenfield('getTokens').map(function (token) { return token.value; });
    var dest = $('#dest').tokenfield('getTokens').map(function (token) { return token.value; });

    if (orig.length)
	$('#orig-tokenfield').removeAttr('placeholder');

    if (dest.length)
	$('#dest-tokenfield').removeAttr('placeholder');

    // limit flights checked airports only
    // if no destination given, add all outgoing flights by carrier
    var plot_data = {};
    $.each(flights, function(i, flight) {
	if (orig.indexOf(flight.origin) >= 0 && (dest.length == 0 || dest.indexOf(flight.dest) >= 0)) {
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

    $('#step_2').animate({opacity: 1}, 2000, function() {
	$('#step_3').animate({opacity: 1}, 2000);
    });
}
