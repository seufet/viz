
/* <div class="loader"></div>
	ToDo: 
	-don't use a drop-down if possible; maybe check boxes for data to include, e.g. cases, hosp, deaths, vaccinations
	-check box to show: raw values, per 100k, year-to-year pct change
	-be able to show prior year data ahead of current date: start date, time period
	-find max dates for nyt, hhs series and note
	-loading icon
	
	-vaccination: https://data.cdc.gov/api/views/unsk-b7fc/rows.csv?accessType=DOWNLOAD, Series_Complete_Pop_Pct

	
	-Credits:
	Tooltips: https://bl.ocks.org/dianaow/0da76b59a7dffe24abcfa55d5b9e163e
	Case, death data: NY Times, https://github.com/nytimes/covid-19-data
	Hospitalization, death data: HealthData.gov, https://healthdata.gov/api/views/g62h-syeh/rows.csv?accessType=DOWNLOAD
	
	v2 Design:
	-Select states: 1-5 --> nest by state
	-Select data: case, death, hosp, vacc
	-Select metric: % Change (1 Year), 7-Day Average (Per 100k), 7-Day Average (Count)
	-Select dates: start date, # months
	
	
	- enter(). path, path, path, path for each metric with different classes: 
		case, case-per, case-chg, etc.
	- can cycle through data set multiple times adding line, legend entry, tool-tip with different class and column
	-if metric is % change, we'll add 1 line per state; others will add 2 lines, but can show similar tt text regardless, only col 
	  will change based on 100k vs raw
	
	-Tooltip:
	  -MA
	     Cases: 500 --> 750 (50% increase)
		 Hosp:  100 --> 125 (25% increase)
		 Deaths: 25 --> 20 (20% decrease)
		 
*/


//alert("This alert box was called with the onload event");


////////////////////////////////////////////////////////////////////////
// GLOBALS

// title prefix
var titlePrefix = "Pandemic Comparison by Year: ";
var lastSeriesLength = 0;

// set the dimensions and margins of the graph
var margin = {top: 10, right: 30, bottom: 30, left: 60},
    width = 800 - margin.left - margin.right,
    height = 375 - margin.top - margin.bottom;

var chartHeight = 350 - 75;

var titleDiv;

// color function
var colorByState;

// data globals
var hhsData;
var nytData;
var statePop;
var popLookup;
var vaccineData;
var hhsLookup = {};

var y, yAxis;
var x, xAxis;
var sumstat;
var uniqueSeries;

var stateNameLookup;

	
// date parser function
var parseDate = d3.timeParse("%Y/%m/%d");

// SELECT BUTTONS

// the currently selected group
groupSelected = "cases_ma";

// Map column names to user-friendly descriptions
var groups = {
	pctChange : "Covid % Change (1 year)",
	cases_ma : "Covid Cases",
	cases_100k_ma : "Covid Cases (per 100k)",
	ip_covid_ma : "Covid Hospitalized",
	ip_covid_100k_ma : "Covid Hospitalized (per 100k)",
	deaths_ma : "Covid Deaths",
	deaths_100k_ma : "Covid Deaths (per 100k)"
};

var decimals = {
	cases_ma : 0,
	cases_100k_ma : 0,
	ip_covid_ma : 0,
	ip_covid_100k_ma : 1,
	deaths_ma : 1,
	deaths_100k_ma : 2
};

var startMonths = {
	"May, 2021":"2021/05/01",
	"June, 2021":"2021/06/01",
	"July, 2021":"2021/07/01",
	"August, 2021":"2021/08/01",
	"September, 2021":"2021/09/01",
	"October, 2021":"2021/10/01",
	"November, 2021":"2021/11/01",
	"December, 2021":"2021/12/01"
};

// basic configuration
var defaultStatesSelected = ["MA","XX","XX","XX","XX"];
var statesSelected;
var defaultStartDate = "2021/07/01";
var defaultNumMonths = 8;
var defaultData = "pctChange";
var endDate = new Date();
var paletteStr = "black,blue,brown,gray,red";

var startDate;
var numMonthsSel;

// our main d3 container
var svg;


// Credit: HealthData.gov: 
// Download: https://healthdata.gov/api/views/g62h-syeh/rows.csv?accessType=DOWNLOAD
//d3.csv("hhs_data_full.csv", hhsLoaded);

function startup(){
	// start with dynamic content hidden
	d3.select("#d3Content").style("display","none");

	// append the svg object to the body of the page
	svg = d3.select("div#container")
	  .append("svg")
	  .attr("preserveAspectRatio", "xMidYMid meet")
	  .attr("viewBox", "0 0 800 400")
	  .classed("svg-content", true)
	  .append("g")
	  .attr("transform",
      "translate(" + margin.left + "," + margin.top + ")");
		  
	d3.select("#loadingMsg").html("Loading Hospitalization Data...");
	d3.csv("https://healthdata.gov/api/views/g62h-syeh/rows.csv?accessType=DOWNLOAD", hhsLoaded);
	
	makeAllSortable();
}

////////////////////////////////////////////////////////////////////////////////////////
// End of main script



/////////////////////////////////////////////////////////////////////////////////////////
// UTILITY FUNCTIONS

// utility to set value of a select box
function selectElement(id, valueToSelect) {    
	let element = document.getElementById(id);
	if (element != null) element.value = valueToSelect;
}

function elementValue(id) {
	let element = document.getElementById(id);
	return element.value;
}


// Chained callback functions to read the data
function hhsLoaded(error, data) {
	console.log("hhsLoaded: " + data.length);
	hhsData =  data;
		
	d3.select("#loadingMsg").html("Loading State Demographic Data...");
	d3.csv("https://seufet.github.io/viz/state_pop.csv", statePopLoaded);
}

function statePopLoaded(error, data) {
	statePop = data;
	console.log("statePopData: " + statePop.length);
	
	// Credit: NY Times, https://github.com/nytimes/covid-19-data
	// Download: https://raw.githubusercontent.com/nytimes/covid-19-data/master/rolling-averages/us-states.csv	
	//d3.csv("nyt_data.csv", loadPage);
	d3.select("#loadingMsg").html("Loading Cases/Deaths Data...");
	d3.csv("https://raw.githubusercontent.com/nytimes/covid-19-data/master/rolling-averages/us-states.csv", nytLoaded);
}

function nytLoaded(error, nyt) {
//	-vaccination: https://data.cdc.gov/api/views/unsk-b7fc/rows.csv?accessType=DOWNLOAD, 
	// save data
	nytData = nyt;
	console.log("nytData: " + nytData.length);
	
	d3.select("#loadingMsg").html("Loading Vaccination Data...");
	d3.csv("https://data.cdc.gov/api/views/unsk-b7fc/rows.csv?accessType=DOWNLOAD", loadPage);
}

// Finish getting the page ready after our data sets are loaded
function loadPage(error, vd) {
	// save vaccine data 
	vaccineData = vd;
	console.log("vaccineData: " + vaccineData.length);
	
	// Update loader
	d3.select("#loadingMsg").html("Processing Data...");
	
	// clean the state population info
	popLookup = {};
	stateNameLookup = {"None":"XX"};
	statePop.forEach(d => {
		d.population = d.population.replace(/,/g,""); // strip out any commas
		popLookup[d.state] = parseInt(d.population);
		stateNameLookup[d.full_name] = d.state;
		//console.log(d.full_name + "-" + d.state);
	});
	console.log("MA POP=" + popLookup["MA"]);

	// add the options to the data button
	d3.select("#selectButton")
	  .selectAll('myOptions')
		.data(Object.keys(groups))
	  .enter()
		.append('option')
	  .text(d => groups[d]) // text showed in the menu
	  .attr("value", d => d) // co2responding value returned by the button

	// add the options to the StartDate button
	d3.select("#startDateButton")
	  .selectAll('myOptions')
		.data(Object.keys(startMonths))
	  .enter()
		.append('option')
	  .text(d => d) // text showed in the menu
	  .attr("value", d => startMonths[d]) // co2responding value returned by the button

	// add the options to the StartDate button
	let numMonths = [1,2,3,4,5,6,7,8,9,10,11,12];
	d3.select("#monthsButton")
	  .selectAll('monthOptions')
		.data(numMonths)
	  .enter()
		.append('option')
	  .text(d => d) // text showed in the menu
	  .attr("value", d => d) // co2responding value returned by the button
	selectElement("monthsButton",defaultNumMonths);

	// this just makes sure that "None" always sorts to the top
	stateSort = Object.keys(stateNameLookup).sort((a,b) => (a == "None" ? -1 : b == "None" ? 1 : a>b ? 1 : -1));
	d3.selectAll(".stateButton")
	  .selectAll('myOptions')
		.data(stateSort)
	  .enter()
		.append('option')
	  .text(d => d) // text showed in the menu
	  .attr("value", d => stateNameLookup[d]) // co2responding value returned by the button

	// default values for states
	statesSelected = defaultStatesSelected;
	for (i=0; i<statesSelected.length; i++){
		if (statesSelected[i] != null) {
			selectElement("state"+(i+1),statesSelected[i]);
		}
	}
	selectElement("startDateButton",defaultStartDate);
	selectElement("selectButton",defaultData);
	groupSelected = defaultData;

	// prepare a lookup for the vaccination info
	let vaccineLookup = {};
	vaccineData.forEach(d => {
			var mdyDate = d3.timeParse("%m/%d/%Y");
			let pk = d.Location + "-" + mdyDate(d.Date).getTime();
			vaccineLookup[pk] = d;
	});

	// prepare a lookup for the nyt info, note we leave date as a yyyy-mm-dd string
	// nyt data set uses full state names, so we have to map
	let nytLookup = {};
	nytData.forEach(d => {
		let pk = stateNameLookup[d.state] + "-" + d.date;
		nytLookup[pk] = d;
	});
	
	// build a record lookup by date
	let vaccineGood = 0, vaccineBad = 0;
	let lastVaxByState = {};
	hhsData.sort((a, b) => (a.date > b.date) ? 1 : -1);
	hhsData.forEach(function(d) {
		d.dateStr = d.date.replace(/\//g,"-"); // replace / with -
		d.surge = "Year 2";
		d.series = d.state + ", " + d.surge;
		d.date = parseDate(d.date);
		d.ip_covid = parseInt(d.inpatient_beds_used_covid);
		d.deaths_covid = parseInt(d.deaths_covid);
		
		nytRow = nytLookup[d.state + "-" + d.dateStr];
		if (nytRow != null) {
			d.cases = parseFloat(nytRow.cases);
			d.cases_ma = parseFloat(nytRow.cases_avg);
			d.cases_100k_ma = parseFloat(nytRow.cases_avg_per_100k);
			d.deaths = parseFloat(nytRow.deaths);
			d.deaths_ma = parseFloat(nytRow.deaths_avg);
			d.deaths_100k_ma = parseFloat(nytRow.deaths_avg_per_100k);
			//if (d.state == "MA") console.log(d.dateStr + "-" + d.cases);
		} else {
			//console.log("missing nyt data: " + d.state + "-" + d.dateStr);
		}
		
		vaccineRow = vaccineLookup[d.state + "-" + d.date.getTime()];
		if (vaccineRow != null) {
			d.vaccine_pct = parseFloat(vaccineRow.Series_Complete_Pop_Pct);
			lastVaxByState[d.state] = d.vaccine_pct;
			vaccineGood++;
		} else {
			vaccineBad++;
			// if vaccine data missing for a date, use last good value
			if (lastVaxByState[d.state] != null) d.vaccine_pct = lastVaxByState[d.state];
		}
		
		pop = popLookup[d.state];
		d.ip_covid_100k = 100000*d.ip_covid/pop;
		d.deaths_covid_100k = 100000*d.deaths_covid/pop;
		d.pk = d.series + "-" + d.date.getTime();
		hhsLookup[d.pk] = d;
	});
	console.log("vaccine good: " + vaccineGood + " - vaccineBad: " + vaccineBad);

	//////////////////////////////////////////////////////////////////
	// Hidden tooltip
	tooltip = d3.select("div#container").append("div")
		.attr('id', 'tooltip')
		.style('padding', 6)
		.style('display', 'none')

	//////////////////////////////////////////////////////////////////
	// Assign the event handlers
	
	// When new data is selected, run the update() function
    d3.select("#selectButton").on("change", function(d) {
        // recover the option that has been chosen and update
        groupSelected = d3.select(this).property("value")
        update();
    })
	// update if new state chosen
	d3.selectAll(".stateButton").on("change", function(d) {
        update();
    })
	// update if new startDate chosen
	d3.select("#startDateButton").on("change", function(d) {
        update();
    })
	
	// update if new number of months chosen
	d3.select("#monthsButton").on("change", function(d) {
        update();
    })
	
	// Add Y axis
	  svg.selectAll(".myYAxis").remove();
	  y = d3.scaleLinear()
		.domain([0, d3.max(hhsData, function(d) { return +d[groupSelected]; })])
		.range([ height-75, 0 ]);
	  yAxis = d3.axisLeft().scale(y);
	  svg.append("g")  
	  .attr("class","myYaxis")
	  .call(yAxis);
	  
	  x = d3.scaleTime()
    .domain(d3.extent(hhsData, function(d) { return d.date; }))
    .range([ 0, width ]);
	xAxis = d3.axisBottom(x).scale(x).tickFormat(d3.timeFormat("%b %d"));
  
	  svg.append("g")
	.attr("class","myXAxis")
    .attr("transform", "translate(0," + (height-75) + ")")
    .call(xAxis);

	// create the table
	createTable();

	// start off with a selection
	update();
	
	// We're finished loading! Hide loader, show content
	d3.select("#loadingContent").style("display","none");
	d3.select("#d3Content").style("display","block");
} // end of loadPage() 

// A function that updates the chart when the various controls change (date range, data set, etc)
function update() {
	console.log("update! groupSelected=" + groupSelected);

	//////////////////////////////////////////////////////////////////
	// read input
	
	// process state selections
	statesSelected = [];
	for (i=1; i<=5; i++){
		let v = elementValue("state"+i);
		statesSelected.push(v);
	}

	// start date and # months
	numMonthsSel = parseInt(elementValue("monthsButton"));
	startDate = parseDate(elementValue("startDateButton"));
	console.log("Start Date:" + startDate + " Months:" + numMonthsSel);
	
	// start with only selected states to ease processing/memory
	var data = hhsData.filter(d => statesSelected.includes(d.state));

	
	// prior year records
	let priorYear = [];
	
	// add records for the needed columns
	data.forEach(function(d) {
		// make a copy of the data for a year earlier than d, and add it to the priorYear array with a modified state name
		// this enables us to have lines for the same state/date, but with the prior year records having a false date
		let priorDate = new Date(d.date.getFullYear()-1,d.date.getMonth(),d.date.getDate());
		let priorRow = Object.assign({}, hhsLookup[d.series+"-"+priorDate.getTime()]);
		
		// if prior row exists, add it to the priorYear array
		if (priorRow != null) {
			priorRow.surge = "Year 1";
			priorRow.series = d.state + ", " + priorRow.surge;
			priorRow.date = d.date;
			priorRow.dateStr = d.dateStr;
			priorRow.pk = priorRow.series + "-" + priorRow.date.getTime();
			priorYear.push(priorRow);
			
			d.prior = priorRow;
		}
	});
	
	// add some for between 10-12 months ago, so we can see last year's values ahead of today a bit
	let oneDay = 1000 * 3600 * 24;
	let today = new Date();
	let startDateAgo = Math.floor((today.getTime()-startDate.getTime())/oneDay);
	let daysAdd = numMonthsSel*30-startDateAgo;
	
	console.log("Start date days ago: " + startDateAgo + " - numMonths=" + numMonthsSel);
	let oneYearAgo = new Date(today.getFullYear()-1,today.getMonth(),today.getDate());
	let peekData = data.filter(d => {
		daysDiff = Math.floor((d.date.getTime()-oneYearAgo.getTime())/oneDay);
		return (daysDiff >= 0 && daysDiff < daysAdd);
	});
	console.log("PEEK DATA FILTER:" + peekData.length);
	peekData.forEach(d => {
		let newDate = new Date(d.date.getFullYear()+1,d.date.getMonth(),d.date.getDate());
		let priorRow = Object.assign({}, hhsLookup[d.series+"-"+d.date.getTime()]);
		
		// if prior row exists, add it to the priorYear array
		if (priorRow != null) {
			priorRow.surge = "Year 1";
			priorRow.series = d.state + ", " + priorRow.surge;
			priorRow.date = newDate;
			priorRow.dateStr = d.dateStr;
			priorRow.pk = priorRow.series + "-" + priorRow.date.getTime();
			priorYear.push(priorRow);
			
			d.prior = priorRow;
		}
	});
	
	console.log("orig hhsData size: " + hhsData.length);
	console.log("priorYear size: " + priorYear.length);
	data = hhsData.concat(priorYear);
	console.log("combined data size: " + data.length);
	
	// state palette
	colorByState = d3.scaleOrdinal()
	.domain(statesSelected)
	.range(paletteStr.split(","));
	
	// sort after assigning palette
	statesSelected.sort();
	
	// update title
	d3.select("#chart-title")
		.html(titlePrefix + groups[groupSelected])
	
	
	let dataLowerLimit = new Date(startDate.getFullYear(),startDate.getMonth(),startDate.getDate()-7);
	data = data.filter(function(d,i){ return statesSelected.indexOf(d.state) >= 0 && d.date >= dataLowerLimit; });
	
	// IMPORTANT: make sure we're still sorted by date, else the lines will scribble all over in the wrong order!
	data.sort((a, b) => (a.date > b.date) ? 1 : -1);
    
	//////////////////////////////////////////////////////////////////////////////////	
	// Compute 7-day moving averages for each series
		
	// get set of unique series
	uniqueSeries = Array.from(new Set(data.map(d => d.series)));
	uniqueSeries.sort();
	console.log(uniqueSeries);
	
	uniqueSeries.forEach(series => {
		maDays = 7;
		seriesData = data.filter(d => d.series == series);
		seriesData.sort((a, b) => (a.date > b.date) ? 1 : -1);
		seriesData[0].ip_covid_rollsum = seriesData[0].ip_covid;
		seriesData[0].ip_covid_100k_rollsum = seriesData[0].ip_covid_100k;
		for (var i = 1 ; i < seriesData.length ; i++) {
			seriesData[i].ip_covid_rollsum = seriesData[i-1].ip_covid_rollsum + seriesData[i].ip_covid;
			seriesData[i].ip_covid_100k_rollsum = seriesData[i-1].ip_covid_100k_rollsum + seriesData[i].ip_covid_100k;
		}
		for (var i = 0 ; i < seriesData.length ; i++) {
			if (i<maDays) {
				seriesData[i].ip_covid_ma = 0;
				seriesData[i].ip_covid_100k_ma = 0;
			}
			else {
				seriesData[i].ip_covid_ma = (seriesData[i].ip_covid_rollsum-seriesData[i-maDays].ip_covid_rollsum)/maDays;
				seriesData[i].ip_covid_100k_ma = (seriesData[i].ip_covid_100k_rollsum-seriesData[i-maDays].ip_covid_100k_rollsum)/maDays;
			}
		}
		
		// clean data - track last good death # for each state
		lastGoodDeathCt = {};
		
		// now that the moving averages are calculated, do the pct change
		seriesData.forEach(d => {
			if (d.prior == null) return;
			if (d.prior.cases_ma != 0){
				d.change_cases_ma = (d.cases_ma/d.prior.cases_ma);
			} 
			else d.change_cases_ma = 1;
		
			if (d.prior.ip_covid_ma != 0){
				d.change_ip_covid_ma = (d.ip_covid_ma/d.prior.ip_covid_ma);
			} 
			else d.change_ip_covid_ma = 1;
			
			if (d.prior.deaths_ma != 0){
				d.change_deaths_ma = (d.deaths_ma/d.prior.deaths_ma);
				lastGoodDeathCt[d.state] = d.change_deaths_ma;
			} 
			else if (lastGoodDeathCt[d.state] != null) d.change_deaths_ma = lastGoodDeathCt[d.state];
			else d.change_deaths_ma = 1;	
		});	
	});

	if (groupSelected == "pctChange") {
		updatePct(data);
	} else {
		updateStandard(data);
	}
}

// Draws the standard chart
function updateStandard(data){
  // group the data: want to draw one line per group
  sumstat = d3.nest() // nest function allows to group the calculation per level of a factor
	.key(function(d) { return d.series;})
    .entries(data);

	// update title
  d3.select("div#chart-title")
	.html(titlePrefix + groups[groupSelected])
	
  // Add X axis --> it is a date format
  plottedData = data.filter((d,i) => d.date >= startDate);
  svg.selectAll(".myXAxis").remove();
  x = d3.scaleTime()
    .domain(d3.extent(plottedData, function(d) { return d.date; }))
    .range([ 0, width ]);
  xAxis = d3.axisBottom(x).scale(x).tickFormat(d3.timeFormat("%b %d"));
  svg.append("g")
	.attr("class","myXAxis")
    .attr("transform", "translate(0," + (height-75) + ")")
    .call(xAxis);

  

  ////////////////////////////////////////////////////////
  // tool-tip stuff

	// rebuild all tool-tip stuff from scratch on each call to update()
	svg.selectAll(".mouse-over-effects").remove();

  mouseG = svg.append("g")
	.attr("class", "mouse-over-effects");

  mouseG.append("path") // create vertical line to follow mouse
	.attr("class", "mouse-line")
	.style("stroke", "#A9A9A9")
	.style("stroke-width", "2px")
	.style("opacity", "0");

  // for the little circles on the vertical line
  var mousePerLine = mouseG.selectAll('.mouse-per-line')
	.data(sumstat)
	.enter()
	.append("g")
	.attr("class", "mouse-per-line");

  mousePerLine.append("circle")
	.attr("r", 4)
	.style("stroke", d => {
		return colorByState(d.key.substring(0,2));
	})
	.style("fill", "none")
	.style("stroke-width", "2px")
	.style("opacity", "0");

  mouseG.append('svg:rect') // append a rect to catch mouse movements on canvas
	.attr('width', width) 
	.attr('height', height)
	.attr('fill', 'none')
	.attr('pointer-events', 'all')
	.on('mouseout', function () { // on mouse out hide line, circles and text
	  d3.select(".mouse-line")
		.style("opacity", "0");
	  d3.selectAll(".mouse-per-line circle")
		.style("opacity", "0");
	  d3.selectAll(".mouse-per-line text")
		.style("opacity", "0");
	  d3.selectAll("#tooltip")
		.style('display', 'none')
	})
	.on('mouseover', () => { // on mouse in show line, circles and text
	  d3.select(".mouse-line")
		.style("opacity", "1");
	  d3.selectAll(".mouse-per-line circle")
		.style("opacity", "1");
	  d3.selectAll("#tooltip")
		.style('display', 'block')
	})
	.on('mousemove', function() { // update tooltip content, line, circles and text when mouse moves
		var mouse = d3.mouse(this);  
		var xDate = x.invert(mouse[0]); // get date corresponding to mouse x position
		
		if (groupSelected == "pctChange"){
				console.log("pctChange mouse move");
		} else {
			// move the circles that highlight each point
			d3.selectAll(".mouse-per-line")
			.attr("transform", (d, i) => {
				//console.log("transform: " + d.date + " i=" + i);
				// find index in the data corresponding to the date/mouse position and position the circle x/y
				var idx = d3.bisector(d => d.date).left(d.values, xDate);
				
				if (d.values[idx] == null) return "translate(-500,-500)";
				return "translate(" + x(d.values[idx].date) + "," + y(d.values[idx][groupSelected]) + ")";
			}); // end attr statement
			
			// move the vertical line
			d3.select(".mouse-line")
				.attr("d", () => ("M" + x(xDate) + "," + (chartHeight-15) + " " + x(xDate) + "," + 0));
		}
		
		// update the text in the box
		updateTooltipContent(mouse);
	})
	
	// update y axis (x axis stays same for now) with 1s transition
	y.domain([0, d3.max(data, d => +d[groupSelected]) ]);
	svg.selectAll(".myYaxis")
		.transition()
		.duration(1000)
		.call(yAxis);

	// if we have a different # of lines to draw, remove the old ones
	// otherwise we have extra lines hanging around if one or more are supposed to be removed
	if (uniqueSeries.length != lastSeriesLength){
		svg.selectAll(".lineTest").remove();
	}
	
	lastSeriesLength = uniqueSeries.length;
	var u = svg.selectAll(".lineTest").data(sumstat);
	
	  // Draw the lines
	  u.enter()
		.append("path")
		.attr("class","lineTest")
		.merge(u)
		.transition()
		.duration(1000)
		.attr("d", function(d){
			return d3.line()
				// this clips the lines so they won't go beyond the axis limit!
				.defined(d => d.date >= startDate)
				.x(function(d) { return x(d.date); })
				.y(function(d) { return y(+d[groupSelected]); })
				(d.values)
		})
	  .attr("fill", "none")
	  .attr("stroke", d => colorByState(d.key.substring(0,2)))
	  .style("stroke-width", 2)
	  // Year 2 not dashed, Year 1 dashed
		.style("stroke-dasharray", (d) => d.key.endsWith("Year 2") ? "3,0" : "3,3" )
	u.exit().remove();
	
	// Add a short line in the legend for each entry.
	console.log("UNIQUE SERIES: " + uniqueSeries);
	var lineLength = 20;
	var totalLength = 120;
	svg.selectAll(".legendLines").remove();
	legendLines = svg.selectAll(".legendLines").data(uniqueSeries);
	legendLines
	  .enter()
	  .append("line")
	  .merge(legendLines)
		.attr("class","legendLines")
		.attr("x1", (d,i) => i%2==0?50+totalLength*i/2:50+totalLength*(i-1)/2)
		.attr("x2", (d,i) => lineLength+(i%2==0?50+totalLength*i/2:50+totalLength*(i-1)/2))
		.attr("y1", d => d.endsWith("Year 1") ? height-40 : height-25)
		.attr("y2", d => d.endsWith("Year 1") ? height-40 : height-25)
		//.style("stroke", d => stateColors[d.substring(0,2)])
		.attr("stroke", d => colorByState(d.substring(0,2)))
		.style("stroke-width", 2)
		.style("stroke-dasharray", (d) => d.endsWith("Year 2") ? "3,0" : "3,3" )

	// Add legend text
	svg.selectAll(".legendText").remove();
	legendText = svg.selectAll(".legendText")
	  .data(uniqueSeries);
	 legendText
	  .enter()
	  .append("text")
		.merge(legendText)
		.attr("class","legendText")
		.attr("x", (d,i) => 5+lineLength+(i%2==0?50+totalLength*i/2:50+totalLength*(i-1)/2))
		.attr("y", d => d.endsWith("Year 1") ? height-39 : height-24)
		.style("fill", d => colorByState(d.substring(0,2)))
		.style("font", "12px times")
		.text(d => d) // text is the series name
		.attr("text-anchor", "left")
		.style("alignment-baseline", "middle")
		
	// compute max dates	
	console.log("hhs max date: " + d3.max(data, d => d.date));
	console.log("nyt max date: " + d3.max(nytData, d => d.date));
}

  
// This is called by the chart's mouse movement listener  
// to write the text that shows in the tooltip box
function updateTooltipContent(mouse) {
	if (groupSelected == "pctChange"){
		updateTooltipContentPct(mouse);
	} else{
		updateTooltipContentStandard(mouse);
	}
}

// the standard tool-tip text box content
function updateTooltipContentStandard(mouse) {
	// date for mouse x pos
	var xDate = x.invert(mouse[0])
	  
	// XXX this sorting can likely be simplified...we just want to sort by state abbreviation...
	// populate sortingObj with EACH match in the various groups
	sortingObj = []
	sumstat.map(d => {
	  var idx = d3.bisector(d => d.date).left(d.values, xDate);
	  if (d.values[idx] != null) {
		  sortingObj.push(
			{	
				key: d.values[idx].series, 
				num: d.values[idx][groupSelected],
				date: d.values[idx].date
			})
	  }
	}) // close map()

	// sort them by key, descending
	sortingObj.sort(function(x, y){
	   return d3.ascending(x.key, y.key);
	})

	// strip keys
	var sortingArr = sortingObj.map(d=> d.key)

	// sort by series title
	var sumstat1 = sumstat.slice().sort((a, b) => (sortingArr.indexOf(a.key) - sortingArr.indexOf(b.key)))

	//console.log("pageX=" + d3.event.pageX + " pageY=" + d3.event.pageY);

	/////////////////////////////////////////////////////////////////////
	// tooltip box text
	
	// date at the top and box position
	let localDate = sortingObj[0].date.toLocaleDateString('en-us', { year:"numeric", month:"short", day:"numeric"});
	tooltip.html(localDate + " vs One Year Earlier")
	  .style('left', (d3.event.pageX>500?d3.event.pageX-380:d3.event.pageX) + "px") // choose left or right of cursor depending on 
	  .style('top', (d3.event.pageY - 280) + "px")
	  .style('width', "300px")
	  .style('padding-bottom', "10px")
	  .selectAll()
	  .data(sumstat1).enter() // now a separate line for each series
	  .append('div')
	  .style('color', d => {
		var idx = d3.bisector(d => d.date).left(d.values, xDate);
		return d.values[idx] == null ? "black" : colorByState(d.values[idx].state)
	  })
	  .html(d => {
		var idx = d3.bisector(d => d.date).left(d.values, xDate)
		var row = d.values[idx];
		if (row == null || row[groupSelected] == null) return "";	
		var pctChgMsg = "";
		if (row.surge == "Year 2" && row[groupSelected] != null && row.prior[groupSelected] != null){	
			let pctChg = 100*(row[groupSelected]/row.prior[groupSelected]-1);
			pctChgMsg = " (" + Math.abs(pctChg.toFixed(0)) + "% " + (pctChg>0 ? "Up" : "Down");
			if (row.vaccine_pct != null) pctChgMsg += ", " + row.vaccine_pct.toFixed(0) + "% Vacc)";
			else pctChgMsg += ")";
		} 
		// show series, # of output variable with correct # decimal places
		return d.key + ": " + row[groupSelected].toFixed(decimals[groupSelected]) + pctChgMsg;
	  })
	  .style("font-size","16px")
	  .style("font-weight","normal")
}

// global
var nestedData;
var legendLabels = ["Cases % Chg","Hosp % Chg","Deaths % Chg"];
	
// Draws the pctChange chart
function updatePct(data){
	
	console.log("pctChange update");
  // group the data: for each state, separate lines for cases, hosp, death
  
  // concat data for grouping
  // restrict to date range/year 2 surge, then have series for case, hosp, death
  data = data.filter((d,i) => d.date >= startDate && d.surge == "Year 2");
  console.log("updatePct initial data: " + data.length);

	toAdd = [];
	data.forEach(d => {
		let hospRow = Object.assign({}, d);
		hospRow.pct_series = d.state + "," + 1;
		hospRow.pct_value = parseFloat(d.change_ip_covid_ma);
		toAdd.push(hospRow);
		
		let deathRow = Object.assign({}, d);
		deathRow.pct_series = d.state + "," + 2;
		deathRow.pct_value = parseFloat(d.change_deaths_ma);
		toAdd.push(deathRow);
		
		d.pct_series = d.state + "," + 0;
		d.pct_value = parseFloat(d.change_cases_ma);
	});
	data = data.concat(toAdd);
	//console.log("rows after series creation: " + data.length);

	/*nh = data.filter(d => d.pct_series == "NH,2");
	console.log("NH values: " + nh.length);
	nh.forEach(d => {
			console.log("NH " + d.date.getMonth() + "-" + d.date.getDate() + " " + d.pct_series + "=" + d.pct_value.toFixed(2));
	});*/

	// update y axis to show logarithmic as decreases are in range 0-1 and increase e.g. 1-20.
	// the domain needs to include the max/min value of all 3 metrics for each state/date
	dataMin = d3.min(data, d => Math.min(d.change_cases_ma,d.change_deaths_ma,d.change_ip_covid_ma));
	dataMax = d3.max(data, d => Math.max(d.change_cases_ma,d.change_deaths_ma,d.change_ip_covid_ma));
	console.log("Y axis min/max: " + dataMin + " - " + dataMax);
	logY = d3.scaleLog().domain([dataMin, dataMax]).range([ height-75, 0 ]);
	//yAxis.scale(logY);
	svg.selectAll(".myYaxis")
		.transition()
		.duration(1000)
		.call(d3.axisLeft().scale(logY).ticks(8,(d,i)=>{
			if (d>1) {
				return "+" + (100*(d-1)).toFixed(0) + "%";
			} else if (d==1) {
					return "No Change";
			} else {
				return "-" + (100*(1-d)).toFixed(0) + "%";
			}
			
		}));
		
	svg.selectAll(".myXAxis").remove();
  x = d3.scaleTime()
    .domain(d3.extent(data, function(d) { return d.date; }))
    .range([ 0, width ]);
  xAxis = d3.axisBottom(x).scale(x).tickFormat(d3.timeFormat("%b %d"));
  svg.append("g")
	.attr("class","myXAxis")
    .attr("transform", "translate(0," + (height-75) + ")")
    .call(xAxis);
		
	// group by state then series (i.e. cases, deaths, hosp)
	nestedData = d3.nest()
		.key(d => d.pct_series)
		.entries(data);
	//console.log(nestedData);
	
	dashPatterns = ["3,0","3,3","5,2"];
	
	  // Draw the lines	
	  var u = svg.selectAll(".lineTest").data(nestedData);
	  u.enter()
		.append("path")
		.attr("class","lineTest")
		.merge(u)
		.transition()
		.duration(1000)
		.attr("d", function(d){
			console.log("d function: " + d.key + " values=" + d.values.length);
			return d3.line()
				// this clips the lines so they won't go beyond the axis limit!
				.defined(d => d.date >= startDate)
				.x(function(d) { return x(d.date); })
				.y(function(d) { return logY(+d.pct_value); }) // note we use the log y function, not the linear for standard mode
				(d.values)
		})
	  .attr("fill", "none")
	  .attr("stroke", d => colorByState(d.key.substring(0,2)))
	  .style("stroke-width", 2)
	  // Year 2 not dashed, Year 1 dashed
		.style("stroke-dasharray", d => {
			let tag = d.key.split(",")[1];
			return dashPatterns[tag];
		})	
	u.exit().remove(); // remove any unused lines
	
	// Add a short line in the legend for each entry.
	pctSeries = Array.from(new Set(data.map(d => d.pct_series)));
	pctSeries.sort();
	console.log("SERIES:" + pctSeries);
	
	var lineLength = 20;
	var totalLength = 130;
	svg.selectAll(".legendLines").remove();
	legendLines = svg.selectAll(".legendLines").data(pctSeries);
	legendLines
	  .enter()
	  .append("line")
	  .merge(legendLines)
		.attr("class","legendLines")
		.attr("x1", (d,i) => 50+totalLength*Math.floor(i/3))
		.attr("x2", (d,i) => lineLength+50+totalLength*Math.floor(i/3))
		.attr("y1", (d,i) => height-40+15*(i%3))
		.attr("y2", (d,i) => height-40+15*(i%3))
		.attr("stroke", d => colorByState(d.substring(0,2)))
		.style("stroke-width", 2)
		.style("stroke-dasharray", (d,i) => dashPatterns[i%3])
	
	// Add legend text
	svg.selectAll(".legendText").remove();
	legendText = svg.selectAll(".legendText")
	  .data(pctSeries);
	 legendText
	  .enter()
	  .append("text")
		.merge(legendText)
		.attr("class","legendText")
		.attr("x", (d,i) => 5+lineLength+50+totalLength*Math.floor(i/3))
		.attr("y", (d,i) => height-39+15*(i%3))
		.style("fill", d => colorByState(d.substring(0,2)))
		.style("font", "12px times")
		.text((d,i) => d.substring(0,2)+" "+legendLabels[i%3])
		.attr("text-anchor", "left")
		.style("alignment-baseline", "middle")

  ////////////////////////////////////////////////////////
  // tool-tip stuff

	// rebuild all tool-tip stuff from scratch on each call to update()
	svg.selectAll(".mouse-over-effects").remove();

  mouseG = svg.append("g")
	.attr("class", "mouse-over-effects");

  mouseG.append("path") // create vertical line to follow mouse
	.attr("class", "mouse-line")
	.style("stroke", "#A9A9A9")
	.style("stroke-width", "2px")
	.style("opacity", "0");

  // for the little circles on the vertical line
  var mousePerLine = mouseG.selectAll('.mouse-per-line')
	.data(nestedData)
	.enter()
	.append("g")
	.attr("class", "mouse-per-line");

  mousePerLine.append("circle")
	.attr("r", 4)
	.style("stroke", d => {
		return colorByState(d.key.substring(0,2));
	})
	.style("fill", "none")
	.style("stroke-width", "2px")
	.style("opacity", "0");

  mouseG.append('svg:rect') // append a rect to catch mouse movements on canvas
	.attr('width', width) 
	.attr('height', height)
	.attr('fill', 'none')
	.attr('pointer-events', 'all')
	.on('mouseout', function () { // on mouse out hide line, circles and text
	  d3.select(".mouse-line")
		.style("opacity", "0");
	  d3.selectAll(".mouse-per-line circle")
		.style("opacity", "0");
	  d3.selectAll(".mouse-per-line text")
		.style("opacity", "0");
	  d3.selectAll("#tooltip")
		.style('display', 'none')
	})
	.on('mouseover', () => { // on mouse in show line, circles and text
	  d3.select(".mouse-line")
		.style("opacity", "1");
	  d3.selectAll(".mouse-per-line circle")
		.style("opacity", "1");
	  d3.selectAll("#tooltip")
		.style('display', 'block')
	})
	.on('mousemove', function() { // update tooltip content, line, circles and text when mouse moves
		var mouse = d3.mouse(this);  
		var xDate = x.invert(mouse[0]); // get date corresponding to mouse x position
		
		// move the circles that highlight each point
		d3.selectAll(".mouse-per-line")
		.attr("transform", (d, i) => {
		  // find index in the data corresponding to the date/mouse position and position the circle x/y
		  var idx = d3.bisector(d => d.date).left(d.values, xDate);
		  if (d.values[idx] == null) return "translate(-500,-500)";
		  return "translate(" + x(d.values[idx].date) + "," + logY(d.values[idx].pct_value).toFixed(0) + ")";
		}); // end attr statement
		
		// move the vertical line
		d3.select(".mouse-line")
			.attr("d", () => ("M" + x(xDate) + "," + (chartHeight-15) + " " + x(xDate) + "," + 0));
		
		// update the text in the box
		updateTooltipContentPct(mouse);
	})
}

// tooltip text content if pctChange selected
function updateTooltipContentPct(mouse) {
	//console.log("pctChange tooltip");
	// date for mouse x pos
	var xDate = x.invert(mouse[0])
	  
	// XXX this sorting can likely be simplified...we just want to sort by state abbreviation...
	// populate sortingObj with EACH match in the various groups
	sortingObj = []
	nestedData.map(d => {
	  var idx = d3.bisector(d => d.date).left(d.values, xDate);
	  if (d.values[idx] != null){
	  sortingObj.push(
		{	
			key: d.values[idx].pct_series, 
			num: d.values[idx].pct_value,
			date: d.values[idx].date
		})
	  }
	}) // close map()

	// sort them by key, descending
	sortingObj.sort(function(x, y){
	   return d3.ascending(x.key, y.key);
	})

	// strip keys
	var sortingArr = sortingObj.map(d=> d.key)

	// sort by series title
	var nested1 = nestedData.slice().sort((a, b) => (sortingArr.indexOf(a.key) - sortingArr.indexOf(b.key)))
	
	//console.log("pageX=" + d3.event.pageX + " pageY=" + d3.event.pageY);

	/////////////////////////////////////////////////////////////////////
	// tooltip box text

	var ttLabels = ["Cases","Hosp","Deaths"];

	if (sortingObj[0] == null) return;
	
	// date at the top and box position
	let localDate = sortingObj[0].date.toLocaleDateString('en-us', { year:"numeric", month:"short", day:"numeric"});
	tooltip.html(localDate + " vs One Year Earlier")
	  .style('left', (d3.event.pageX>500?d3.event.pageX-380:d3.event.pageX) + "px") // choose left or right of cursor depending on 
	  .style('top', (d3.event.pageY - 280) + "px")
	  .style('width', "300px")
	  .style('padding-bottom', "10px")
	  .selectAll()
	  .data(nested1).enter() // now a separate line for each series
	  .append('div')
	  .style('color', d => {
		var idx = d3.bisector(d => d.date).left(d.values, xDate);
		return colorByState(d.values[idx].state)
	  })
	  .html(d => {
		var idx = d3.bisector(d => d.date).left(d.values, xDate)
		var row = d.values[idx];
		if (row.pct_value == null) return "";	
		var pctChgMsg = "";
		if (row.pct_value == 1) pctChgMsg = "Unchanged";
		else if (row.pct_value > 1) pctChgMsg = (100*(row.pct_value-1)).toFixed(0) + "% Increase";
		else pctChgMsg = (Math.abs(row.pct_value-1)*100).toFixed(0) + "% Decrease";
		
		// show series, # of output variable with correct # decimal places
		let seriesIdx = d.key.split(",")[1];
		let seriesDesc = row.state + " " + ttLabels[seriesIdx] + ": " + pctChgMsg;
		if (seriesIdx == 0) return row.state + " " + "Fully Vacc: " + (row.vaccine_pct.toFixed(0)) + "%<br>"+seriesDesc;
		else return seriesDesc;
	  })
	  .style("font-size","16px")
	  .style("font-weight","normal")
}


////////////////////////////////////////////////////////////////////////
// Table sorting

// note this allows not sorting certain rows at the top
function sortTable(table, col, reverse, startIdx) {
    let tb = table.tBodies[0]; // use `<tbody>` to ignore `<thead>` and `<tfoot>` rows
    let tr = Array.prototype.slice.call(tb.rows, 1); // put rows into array
    let i;
    reverse = -((+reverse) || -1);
    tr = tr.sort(function (a, b) { // sort rows
		as = a.cells[col].textContent.trim().replace("%","");
		bs = b.cells[col].textContent.trim().replace("%","");
		
		if (!isNaN(as) && !isNaN(bs)){
			av = parseFloat(as);
			bv = parseFloat(bs);
			return reverse * (av>bv?1:av==bv?0:-1)
		} else {
			return reverse * as.localeCompare(bs);
		}
		/*return reverse // `-1 *` if want opposite order
            * (parseFloat(a.cells[col].textContent.trim()) // using `.textContent.trim()` for test
                .localeCompare(parseFloat(b.cells[col].textContent.trim()))
               );*/
    });
    for(i = 0; i < tr.length; ++i) tb.appendChild(tr[i]); // append each row in order
}

function makeSortable(table) {
    var th = table.tHead, i;
    th && (th = th.rows[0]) && (th = th.cells);
    if (th) i = th.length;
    else return; // if no `<thead>` then do nothing
    while (--i >= 0) (function (i) {
        var dir = 1;
        th[i].addEventListener('click', function () {sortTable(table, i, (dir = 1 - dir), 1)});
    }(i));
}

function makeAllSortable(parent) {
    parent = parent || document.body;
    var t = parent.getElementsByTagName('table'), i = t.length;
    while (--i >= 0) makeSortable(t[i]);
}


/////////////////////////////////////////////////////////////////////////////////
// Table manipulation

// table with summary by state
tblData = [];

function tablePctValue(value){
	if (value > 1) return "+" + (100*(value-1)).toFixed(0) + "%";
	else if (value == 1) return "Unchanged";
	else return "-" + (Math.abs(value-1)*100).toFixed(0) + "%";
}

// compute a moving average
function movingAverage(dataSet, col, dt, days){
	let oneDay = 1000 * 3600 * 24;
	let dtOne = new Date(dt.getTime()-days*oneDay);
	
	// filter to date range and sort
	dataSet = dataSet.filter(d=>d.date.getTime()<dt.getTime() && d.date.getTime()>=dtOne.getTime());
	//dataSet.sort((a, b) => (a.date > b.date) ? 1 : -1);
		
	//let sum = dataSet.reduce((a, b) => a + (b[col] || 0), 0);
	let sum = d3.sum(dataSet, d => d[col]);
	return sum / days;
}

// gather the data for a given state
function prepareTableStateData(stateName,stateAbbr){
	//console.log("Table state data: name=" + stateName + " abbr=" + stateAbbr);

	st = hhsData.filter(d => d.state == stateAbbr && d.surge == "Year 2");
	st.sort((a, b) => (a.date > b.date) ? 1 : -1);
	
	idx = st.length-1;
	while (st[idx].cases_100k_ma == null || 
		st[idx].ip_covid == null ||
		st[idx].vaccine_pct == null) idx--; // find last day with all data present
	lastDay = st[idx];
	oneYearAgo = st[idx-365];
	console.log("last day:" + lastDay.date + " year ago=" + oneYearAgo.date);

	// moving avg for 1 year ago
	oldCases = oneYearAgo.cases_100k_ma;
	hosp = movingAverage(st, "ip_covid_100k", lastDay.date, 7);
	oldHosp = movingAverage(st, "ip_covid_100k", oneYearAgo.date, 7);
	oldDeaths = oneYearAgo.deaths_100k_ma;

	tbl = [];
	tbl[0] = stateName;
	tbl[1] = lastDay.cases_100k_ma.toFixed(1);
	tbl[2] = oldCases == 0 ? "Infinite (previous value=0)" : tablePctValue(lastDay.cases_100k_ma/oldCases);
	tbl[3] = hosp.toFixed(1);
	tbl[4] = oldHosp == 0 ? "Infinite (previous value=0)" : tablePctValue(hosp/oldHosp);
	tbl[5] = lastDay.deaths_100k_ma;
	tbl[6] = oldDeaths == 0 ? "Infinite (previous value=0)" : tablePctValue(lastDay.deaths_100k_ma/oldDeaths);
	tbl[7] = lastDay.vaccine_pct + "%";
	tblData.push(tbl);
}

// gather the data for the whole US, push as the first row in the state summary table
function prepareTableUSData(){
	let usPop = d3.sum(Object.values(popLookup));
	
	data = hhsData.filter(d => d.surge == "Year 2");
	data.sort((a, b) => (a.date > b.date) ? 1 : -1);
	
	st = data.filter(d => d.state == "MA" && d.surge == "Year 2");
	st.sort((a, b) => (a.date > b.date) ? 1 : -1);
	
	idx = st.length-1;
	while (st[idx].cases_100k_ma == null || 
		st[idx].ip_covid == null ||
		st[idx].vaccine_pct == null) idx--; // find last day with all data present
	lastDate = st[idx].date;
	//console.log("US table last date:" + lastDate);
	
	oneYearAgoDate = new Date(lastDate.getFullYear()-1,lastDate.getMonth(),lastDate.getDate());
	lastDay = data.filter(d => d.date.getTime() == lastDate.getTime());
	oneYearAgo = data.filter(d => d.date.getTime() == oneYearAgoDate.getTime());
	
	console.log("US table last day:" + lastDate + " year ago=" + oneYearAgoDate);
	console.log("US Records=" + data.length + " last day records:" + lastDay.length + " year ago=" + oneYearAgo.length);
	
	// cases
	oldCases = (d3.sum(oneYearAgo, d=>d.cases_ma)*100000/usPop);
	cases = (d3.sum(lastDay, d=>d.cases_ma)*100000/usPop);
	casesPct = oldCases == 0 ? "Infinite (previous value=0)" : tablePctValue(cases/oldCases);
	
	hosp = movingAverage(data, "ip_covid", lastDate, 7)*100000/usPop;
	oldHosp = movingAverage(data, "ip_covid", oneYearAgoDate, 7)*100000/usPop;
	hospPct = oldHosp == 0 ? "Infinite (previous value=0)" : tablePctValue(hosp/oldHosp);

	// deaths
	oldDeaths = (d3.sum(oneYearAgo, d=>d.deaths_ma)*100000/usPop);
	deaths = (d3.sum(lastDay, d=>d.deaths_ma)*100000/usPop);
	deathsPct = oldDeaths == 0 ? "Infinite (previous value=0)" : tablePctValue(deaths/oldDeaths);
	
	// vaccines
	totalVac = 0.0;
	lastDay.forEach((d,i) => {
		if (popLookup[d.state] != null){
			totalVac += parseFloat(d.vaccine_pct)*popLookup[d.state]/100.0;
		}
	});
	vacPct = 100.0*totalVac/usPop;
	
	
	tbl = [];
	tbl[0] = "United States";
	tbl[1] = cases.toFixed(1);
	tbl[2] = oldCases == 0 ? "Infinite (previous value=0)" : tablePctValue(cases/oldCases);
	tbl[3] = hosp.toFixed(1);
	tbl[4] = oldHosp == 0 ? "Infinite (previous value=0)" : tablePctValue(hosp/oldHosp);
	tbl[5] = deaths.toFixed(2);
	tbl[6] = oldDeaths == 0 ? "Infinite (previous value=0)" : tablePctValue(deaths/oldDeaths);
	tbl[7] = vacPct.toFixed(1) + "%";
	tblData.push(tbl);
}


function prepareTableData(){
	prepareTableUSData();
	let keys = Object.keys(stateNameLookup);
	keys.forEach(d => {
		if (d != "None"){
			prepareTableStateData(d,stateNameLookup[d]);
		}
	});
}

function createTable(){
	var table = document.getElementById('data-table'),
		tbody = table.getElementsByTagName('tbody')[0],
		clone = tbody.rows[0].cloneNode(true);

	prepareTableData();
	let row = tbody.rows[0];
	for (i=0; i<tblData.length; i++){
		rowData = tblData[i];
		
		// replace values of 1st row, but don't clone it
		if (i > 0) row = clone.cloneNode(true);
		for (j=0; j<rowData.length; j++){
			cell = row.cells[j];
			cell.innerHTML = rowData[j];
			if (j == 0) cell.className="stateCol";
			else cell.className="otherCol";
		}
		tbody.appendChild(row);
	}
	sortTable(table,0,-1); // start sorted by state alphabetically
}
