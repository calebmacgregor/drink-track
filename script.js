//Global variables
const object = document.querySelector("#object-list")
const template = document.querySelector("#drink-template")
const form = document.querySelector("#form")
const volumeInput = document.querySelector("#volume-input")
const percentageInput = document.querySelector("#percentage-input")
const standardsEstimatorStandards = document.querySelector(
	"#standards-estimator-standards"
)
const standardsEstimatorBurnoff = document.querySelector(
	"#standards-estimator-burnoff"
)

const LOCAL_STORAGE_PREFIX = "DRINK_TRACK"
const DRINKS_STORAGE_KEY = `${LOCAL_STORAGE_PREFIX}-drinks`

let drinks = loadDrinks()
drinks.forEach(renderDrink)
renderStats()

//Create the drink class
class Drink {
	constructor(volume, percentage) {
		this.drinkID = new Date().getTime()
		this.volume = volume
		this.percentage = percentage
		this.standards = standardsCalculator(volume, percentage)
		this.logDatetime = new Date().getTime()
		this.isDrunk = false
		this.completeDatetime = ""
		this.hoursToBurn = timeToBurn(this.standards).hours
		this.minutesToBurn = timeToBurn(this.standards).minutes
		this.secondsToBurn = timeToBurn(this.standards).seconds
		this.millisecondsToBurn = timeToBurn(this.standards).milliseconds
	}
}

//Event listeners

//Event listener to trigger estimator card render
form.addEventListener("input", (e) => {
	const volume = volumeInput.value ? volumeInput.value : ""
	const percentage = percentageInput.value ? percentageInput.value : ""

	volume && percentage
		? renderEstimator(volume, percentage)
		: (standardsEstimatorBurnoff.innerText = "") &&
		  (standardsEstimatorStandards.innerText =
				"Enter the volume and percentage")
})

//Event listener to add new drinks to the beginning of the drinks storage array
form.addEventListener("submit", (e) => {
	e.preventDefault()
	const volume = volumeInput.value ? volumeInput.value : ""
	const percentage = percentageInput.value ? percentageInput.value : ""
	if (!volume || !percentage) return
	const drink = new Drink(volume, percentage)

	drinks.unshift(drink)

	volumeInput.value = ""
	percentageInput.value = ""
	standardsEstimatorStandards.innerText = "Enter the volume and percentage"
	standardsEstimatorBurnoff.innerText = ""

	updateData()
	renderData()
})

//Delete drinks when the delete button is clicked
document.addEventListener("click", (e) => {
	//Short circuit if the element clicked is not the button with the ID of delete-drink
	if (!e.target.classList.contains("delete-drink")) return
	//Prevent the default submit behaviour of the button
	e.preventDefault()

	const DOMDrink = e.target.closest("#drink-card")
	deleteDrink(DOMDrink)

	updateData()
	renderData()
})

//Mark a drink as drunk when the drink button is clicked
document.addEventListener("click", (e) => {
	//Short circuit if the element clicked is not the button with the ID of mark-drunk
	if (!e.target.matches("#mark-drunk")) return
	//Prevent the default behaviour
	e.preventDefault()

	const DOMDrink = e.target.closest("#drink-card")
	markDrunk(DOMDrink)

	updateData()
	renderData()
})

//Functions

//Render functions
//Render the estimator card
function renderEstimator(volume, percentage) {
	const standards = standardsCalculator(volume, percentage)
	const hoursToBurn = timeToBurn(standards).hours
	const minutesToBurn = timeToBurn(standards).minutes

	standardsEstimatorStandards.innerText = `${standards}x standards`

	if (hoursToBurn > 0 && minutesToBurn == 0) {
		standardsEstimatorBurnoff.innerText = `Burned off in ${hoursToBurn} hours flat`
	} else if (hoursToBurn == 0 && minutesToBurn > 0) {
		standardsEstimatorBurnoff.innerText = `Burned off in ${minutesToBurn} minutes`
	} else if (hoursToBurn > 0 && minutesToBurn > 0) {
		standardsEstimatorBurnoff.innerText = `Burned off in ${hoursToBurn} hours and ${minutesToBurn} minutes`
	} else {
		standardsEstimatorBurnoff.innerText = `If you can see this, something's broken`
	}
}

//Render the stats card
function renderStats() {
	//Ensure that all drink objects have the latest data before rendering
	updateData()

	//Grab the DOM elements needed
	const statsCard = document.querySelector("#stats-card")

	const activeStandards = statsCard.querySelector("#active-standards")
	const consumedStandards = statsCard.querySelector("#consumed-standards")
	const burnedStandards = statsCard.querySelector("#burned-standards")

	if (standardsConsumed() == 0) {
		activeStandards.innerText = "Start drinking to check your stats"
		consumedStandards.remove()
		burnedStandards.remove()
	} else {
		activeStandards.innerText = `${standardsInSystem()}x standards in your system`
		consumedStandards.innerText = `${standardsConsumed()}x standards consumed this session`
		const burnedStandardsNumber = (
			standardsConsumed() - standardsInSystem()
		).toFixed(2)
		burnedStandards.innerText = `${burnedStandardsNumber}x standards already burned off`
	}
}

//Render drink
function renderDrink(drink) {
	//Ensure that all drink objects have the latest data before rendering
	updateData()

	//Grab the list that drinks will be rendered to
	const container = document.querySelector("#container")

	//Grab the individual elements used in rendering
	const templateClone = template.content.cloneNode(true)
	const drinkContainer = templateClone.querySelector("#drink-card")
	const standards = templateClone.querySelector("#standards")
	const startedDatetime = templateClone.querySelector("#started-datetime")
	const finishedDatetime = templateClone.querySelector("#finished-datetime")
	const drinkSubtitle = templateClone.querySelector("#drink-subtitle")
	const drinkButton = templateClone.querySelector("#mark-drunk")
	const deleteButton = templateClone.querySelector("#delete-drink")
	const smallDeleteButton = templateClone.querySelector("#small-delete-drink")
	const progressBar = templateClone.querySelector("#progress")

	//Add a 'drunk' class to a drink-card if that drink has been drunk
	drink.isDrunk ? drinkContainer.classList.add("drunk") : ""

	//Remove the 'drink' button from the element if it has been marked as drunk
	drinkContainer.classList.contains("drunk") ? drinkButton.remove() : ""

	//Remove the 'delete' button from the element if it has been marked as drunk
	if (drinkContainer.classList.contains("drunk")) {
		progressBar.value = drink.percentBurned
		drinkContainer.classList.contains("drunk") ? deleteButton.remove() : ""
	} else {
		progressBar.remove()
		smallDeleteButton.remove()
	}

	//Set the data element drinkId to the same as the object drinkID
	drinkContainer.dataset.drinkId = drink.drinkID

	//Render the number of standards
	standards.innerText = `${drink.standards}x standards`
	//Render the time the drink was started
	startedDatetime.innerText = `Started at ${timeConverter(drink.logDatetime)}`
	//Render the time the drink was finished, or remove that element if the drink has not been finished
	finishedDatetime.innerText = drink.completeDatetime
		? `Drunk by ${timeConverter(drink.completeDatetime)}`
		: finishedDatetime.remove()
	drinkSubtitle.innerText = setDrinkSubtitle(drink, drinkContainer)
	//Render the element to the DOM
	container.appendChild(templateClone)
}

//Calculation functions
//Calculate the number of standards in a drink
function standardsCalculator(volume, percentage) {
	//Return the number of standards rounded to 1 decimal place
	return ((volume / 1000) * percentage * 0.789).toFixed(1)
}

//Calculate the time taken to burn off the alcohol in a drink
//This function needs adjusting to be more like the alcoholRemaining
//Realistically they need to just be complementary - before and after style
function timeToBurn(standards) {
	const hours = Math.floor(standards)
	//Multiply by 100 to round the fraction
	//Divide by 100 to get back to a percentage
	const hourFraction = Math.ceil((standards - hours) * 100) / 100
	const minutes = 60 * hourFraction
	const seconds = hours * 60 * 60 + minutes * 60
	const milliseconds = seconds * 1000
	//Return an object with the hours and minutes both rounded up
	return {
		hours: Math.ceil(hours),
		minutes: Math.ceil(minutes),
		seconds: Math.ceil(seconds),
		milliseconds: Math.ceil(milliseconds)
	}
}

//Calculate the amount of time until a given drink is burned off
function alcoholRemaining(drink) {
	//Short circuit if the drink has not been completed
	if (!drink.completeDatetime) return "Drink not completed"
	const currentTime = new Date()
	const millisecondsSinceCompleted = currentTime - drink.completeDatetime
	const secondsSinceCompleted = millisecondsSinceCompleted / 1000
	const secondsTillBurned = drink.secondsToBurn - secondsSinceCompleted
	const minutesTillBurned = Math.ceil(secondsTillBurned / 60)
	const hoursTillBurned = Math.floor(minutesTillBurned / 60)
	const percentBurned = secondsSinceCompleted / drink.secondsToBurn
	const standardsRemaining =
		drink.standards - drink.standards * percentBurned < 0
			? 0
			: drink.standards - drink.standards * percentBurned
	const burnedOff = standardsRemaining > 0 ? false : true

	//Update the drink object
	drink.standardsRemaining = standardsRemaining
	drink.hoursTillBurned = hoursTillBurned
	drink.minutesTillBurned = minutesTillBurned
	drink.secondsTillBurned = secondsTillBurned
	drink.percentBurned = percentBurned
	drink.burnedOff = burnedOff

	return {
		percentBurned: percentBurned,
		secondsTillBurned: secondsTillBurned,
		minutesTillBurned: minutesTillBurned,
		hoursTillBurned: hoursTillBurned,
		standardsRemaining: standardsRemaining
	}
}

//Data movement functions

//Grab items from the browser storage and add them to the todos array
function loadDrinks() {
	//Grab the string value from browser storage
	const drinksString = localStorage.getItem(DRINKS_STORAGE_KEY)
	//Convert the string to an array of JSON objects, or return an empty array if the string is empty
	return JSON.parse(drinksString) || []
}

//Save todos to the browser storage
function saveDrinks() {
	//Set the browser storage equal to the stringified todos array
	localStorage.setItem(DRINKS_STORAGE_KEY, JSON.stringify(drinks))
}

//Delete drinks from both the DOM and the array
function deleteDrink(drinkElement) {
	//Find the item in the array that corresponds with this drink-card
	const arrayDrink = drinks.find(
		(d) => d.drinkID == drinkElement.dataset.drinkId
	)
	//Remove the drink-card element
	drinkElement.remove()
	//Update the array to not include the arrayDrink
	drinks = drinks.filter((d) => d.drinkID != arrayDrink.drinkID)
}

//Mark drinks as drunk
function markDrunk(drinkElement) {
	//Find the associated object in the array
	const arrayObject = drinks.find(
		(d) => d.drinkID == drinkElement.dataset.drinkId
	)
	//Update the isDrunk attribute
	arrayObject.isDrunk = true
	//Update the completeDateimt attribute
	arrayObject.completeDatetime = new Date().getTime()
	updateData()
	renderData()
}

//Utility/helper functions
//Creates 12 hour time strings from datetime integers
function timeConverter(dateTime) {
	//convert the datetime from a string back to a datetime object
	dateTime = new Date(dateTime)
	return dateTime.toLocaleTimeString(["en-AU"], {
		timeStyle: "short"
	})
}

//Simple function to run other functions that update the Drink objects and then save that data
function updateData() {
	drinks.forEach(alcoholRemaining)
	saveDrinks()
	loadDrinks()
}

//Simple function to run other functions that render the DOM
function renderData() {
	container.innerHTML = ""
	drinks.forEach(renderDrink)
	renderStats()
}

//Return the correct string for the drinkSubtitle
//Probably needs a rework sometime soon
function setDrinkSubtitle(drinkObject, drinkElement) {
	if (
		alcoholRemaining(drinkObject).minutesTillBurned <= 0 &&
		drinkElement.classList.contains("drunk")
	) {
		return `Burned by ${timeConverter(
			drinkObject.completeDatetime + drinkObject.millisecondsToBurn
		)}`
	} else if (drinkElement.classList.contains("drunk")) {
		return `${drinkObject.hoursTillBurned} hours and ${
			drinkObject.minutesTillBurned % 60
		} minutes till burned`
	} else if (drinkObject.hoursToBurn && !drinkObject.minutesToBurn) {
		return `Will take ${drinkObject.hoursToBurn} hours flat to burn off`
	} else if (!drinkObject.hoursToBurn && drinkObject.minutesToBurn) {
		return `Will take ${drinkObject.minutesToBurn} minutes to burn off`
	} else if (drinkObject.hoursToBurn && drinkObject.minutesToBurn) {
		return `Will take ${drinkObject.hoursToBurn} hours and ${drinkObject.minutesToBurn} minutes to burn off`
	} else {
		return `If you can see this, something's broken`
	}
}

//Build a system to calculate the amount of alcohol still in someone's system
function standardsInSystem() {
	completedAndUnburnedDrinks = drinks.filter(
		(drink) => drink.isDrunk == true && drink.burnedOff == false
	)
	const output = completedDrinks.reduce((total, drink) => {
		return total + parseFloat(drink.standardsRemaining)
	}, 0)
	return output.toFixed(2)
}

//Build a system to calculate the total number of standards consumed
function standardsConsumed() {
	completedDrinks = drinks.filter((drink) => drink.isDrunk == true)
	const output = completedDrinks.reduce((total, drink) => {
		return total + parseFloat(drink.standards)
	}, 0)
	return output.toFixed(2)
}

//TODO
//Build a queuing system to burn through drinks in order of consumption
