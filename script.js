//Global variables
const object = document.querySelector("#object-list")

const form = document.querySelector("#form")
const volumeInput = document.querySelector("#volume-input")
const percentageInput = document.querySelector("#percentage-input")
const standardsEstimatorStandards = document.querySelector(
	"#standards-estimator-standards"
)

const LOCAL_STORAGE_PREFIX = "DRINK_TRACK"
const DRINKS_STORAGE_KEY = `${LOCAL_STORAGE_PREFIX}-drinks`

let drinks = loadDrinks()
drinks.forEach(renderDrink)
updateData()
renderData()

//Rerender the data every 20 seconds
//This is a terrible idea
//Absolutely need to implement a better solution than this
setInterval(() => {
	renderData()
}, 20000)

//Create the drink class
class Drink {
	constructor(volume, percentage) {
		this.drinkID = new Date().getTime()
		this.volume = volume
		this.percentage = percentage
		this.standards = standardsCalculator(volume, percentage)
		this.logDatetime = new Date().getTime()
		this.isDrunk = false
		this.startedBurning = false
		this.isBurned = false
		this.burnedDatetime = ""
		this.completeDatetime = ""
		this.timeToBurn = timeToBurn(this.standards)
	}
}

function drinkQueue() {
	//Create an array of drinks sorted from oldest started to newest started
	const sortedArray = drinks.sort((a, b) => {
		if (a.completeDatetime < b.completeDatetime) {
			return -1
		}
		if (a.completeDatetime > b.completeDatetime) {
			return 1
		} else return 0
	})

	//Initiate a variable to store the current earliest time a drink can start to be burned
	let earliestBurnStart

	//Loop through every element in the array
	sortedArray.forEach((drink) => {
		if (
			drink.isDrunk == true &&
			drink.isBurned == false &&
			earliestBurnStart == undefined
		) {
			earliestBurnStart = drink.completeDatetime

			drink.burnStartDatetime = earliestBurnStart
			drink.predictedBurnDatetime = earliestBurnStart + drink.timeToBurn

			drink.startedBurning = true

			earliestBurnStart = drink.predictedBurnDatetime
		} else if (
			drink.isDrunk == true &&
			drink.isBurned == false &&
			earliestBurnStart != undefined
		) {
			drink.burnStartDatetime = earliestBurnStart
			drink.predictedBurnDatetime = earliestBurnStart + drink.timeToBurn
			drink.burnStartDatetime < new Date().getTime()
				? (drink.startedBurning = true)
				: (drink.startedBurning = false)

			earliestBurnStart = drink.predictedBurnDatetime
		}
	})
	//Save the array
	drinks = sortedArray
}

//Calculate the amount of time until a given drink is burned off
function alcoholRemaining(drink) {
	//Short circuit if the drink has not been completed
	if (drink.isDrunk == false) return "Drink not completed"

	const currentTime = new Date().getTime()
	const timeSinceCompleted = currentTime - drink.completeDatetime
	const timeTillBurned = currentTime + drink.timeToBurn

	let percentBurned
	if (timeSinceCompleted / drink.timeToBurn > 1) {
		percentBurned = 1
	} else {
		percentBurned = timeSinceCompleted / drink.timeToBurn
	}

	let standardsRemaining
	if (drink.standards - drink.standards * percentBurned < 0) {
		//If there's less than 0% remaining on the drink, reset it to 0
		standardsRemaining = 0
	} else if (drink.startedBurning == true) {
		//If the drink has started burning, calculate the standards remaining
		standardsRemaining = drink.standards - drink.standards * percentBurned
	} else if (drink.isDrunk == true) {
		//If the drink hasn't started burning then set the standards
		//equal to the standards calculated by standardsCalculator
		standardsRemaining = drink.standards
	} else {
		//Coverall that will break things if we hit an exception
		//I should probably handle errors properly
		standardsRemaining = 900
	}

	const isBurned = standardsRemaining > 0 ? false : true

	//Update the drink object
	if (drink.startedBurning == false) {
		//Need to set a value here so that renderDrink doesn't break
		//Fix later
		drink.percentBurned = 0
		drink.standardsRemaining = standardsRemaining
		drink.isBurned = isBurned
	} else {
		drink.standardsRemaining = 0
		drink.standardsRemaining = standardsRemaining
		drink.timeTillBurned = timeTillBurned
		drink.percentBurned = percentBurned
		drink.isBurned = isBurned
	}
}

//Mark drinks as drunk
function markDrunk(drinkElement) {
	//Find the associated object in the array
	const drink = drinks.find((d) => d.drinkID == drinkElement.dataset.drinkId)
	//Update the isDrunk attribute
	drink.isDrunk = true
	//Update the completeDateimt attribute
	drink.completeDatetime = new Date().getTime()
	updateData()
	renderData()
}

//Event listener to trigger estimator card render
form.addEventListener("input", () => {
	const volume = volumeInput.value
	const percentage = percentageInput.value

	if (volume && percentage) renderEstimator(volume, percentage)
})

//Event listener to add new drinks to the beginning of the drinks storage array
form.addEventListener("submit", (e) => {
	e.preventDefault()

	const volume = volumeInput.value
	const percentage = percentageInput.value

	if (!volume || !percentage) return
	const drink = new Drink(volume, percentage)
	const addDrinkTitle = document.querySelector("#add-drink-title")
	const standardsEstimatorStandardsSubtitle = document.querySelector(
		"#standards-estimator-subtitle"
	)

	drinks.unshift(drink)

	volumeInput.value = ""
	percentageInput.value = ""
	standardsEstimatorStandards.innerText = ""
	standardsEstimatorStandardsSubtitle.innerText = ""

	addDrinkTitle.classList.remove("shrunk")

	updateData()
	renderData()
})

//Function to delete on confirm delete
//Set as a named function so that it is removable
function confirmDelete(e) {
	if (!e.target.classList.contains("delete-confirm")) return
	const DOMDrink = e.target.closest("#drink-card")
	deleteDrink(DOMDrink)

	updateData()
	renderData()
}

//Add a delete-confirm drink class to the small delete button on initial click
//Remove it after 3 seconds
document.addEventListener("click", (e) => {
	if (!e.target.matches("#small-delete-drink")) return

	e.target.classList.add("delete-confirm")
	e.target.innerText = ""
	//Update text once the button has grown
	setTimeout(() => {
		e.target.innerText = "Delete"
	}, 150)

	//Add deletion event listener
	e.target.addEventListener("click", confirmDelete)

	setTimeout(() => {
		e.target.classList.remove("delete-confirm")
		e.target.innerText = "X"
		e.target.removeEventListener("click", confirmDelete)
	}, 3000)
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

	const addDrinkTitle = document.querySelector("#add-drink-title")

	addDrinkTitle.classList.remove("shrunk")

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
	const hoursToBurn = Math.floor(timeToBurn(standards) / 1000 / 60 / 60)
	const minutesToBurn = timeToBurn(standards) / 1000 / 60 - hoursToBurn * 60
	const addDrinkTitle = document.querySelector("#add-drink-title")
	const standardsEstimatorStandardsSubtitle = document.querySelector(
		"#standards-estimator-subtitle"
	)

	if (volume && percentage) addDrinkTitle.classList.add("shrunk")

	//Set a very small delay so that the title has time to animate
	//Run this through an if statement so that it only slows down on the first render
	function updateStandardsEstimator() {
		standardsEstimatorStandards.innerText = `${standards}x Standards`
		standardsEstimatorStandardsSubtitle.innerText = `${hoursToBurn} hours and ${minutesToBurn} minutes to burn`
	}

	if (!volume && !percentage) {
		setTimeout(() => {
			updateStandardsEstimator()
		}, 200)
	} else {
		updateStandardsEstimator()
	}
}

//Render the stats card
function renderStats() {
	//Ensure that all drink objects have the latest data before rendering
	updateData()
	//Grab the DOM elements needed
	const activeStandards = document.querySelector("#active-standards")
	const activeStandardsSubtitle = document.querySelector(
		"#active-standards-subtitle"
	)
	const standardsCountdown = document.querySelector("#standards-countdown")
	const standardsConsumedElement = document.querySelector("#standards-consumed")

	const allClear = document.querySelector("#all-clear")

	const hoursTillAllClear = Math.floor(
		standardsInSystem().timeTillAllClear / 1000 / 60 / 60
	)
	const minutesTillAllClear = Math.floor(
		standardsInSystem().timeTillAllClear / 1000 / 60 - hoursTillAllClear * 60
	)

	if (standardsConsumed() != 0) {
		activeStandards.innerText = `${
			standardsInSystem().standardsInSystem
		}x standards`

		//Set values and make items visible when drinks are in the system
		activeStandardsSubtitle.innerText = "currently in your system"
		activeStandardsSubtitle.style.display = "block"

		//Not using this until I can make it look nicer
		// standardsConsumedElement.innerText = `${standardsConsumed()}x standards consumed overall`
		// standardsConsumedElement.style.display = "block"

		if (hoursTillAllClear == 0) {
			standardsCountdown.innerText = `${minutesTillAllClear} minutes\ntill zero standards`
		} else {
			standardsCountdown.innerText = `${hoursTillAllClear} hours and ${minutesTillAllClear} minutes\ntill zero standards`
		}
		standardsCountdown.style.display = "block"

		allClear.innerText = `All clear by ${timeConverter(
			standardsInSystem().allClearTime
		)}`
		allClear.style.display = "block"
	}

	//Cleanup stats card when no drinks are in the system
	if (standardsConsumed() == 0) {
		activeStandards.innerText = "Get started"
		activeStandardsSubtitle.style.display = "none"
		allClear.style.display = "none"
		standardsCountdown.style.display = "none"
		standardsConsumedElement.style.display = "none"
	}
}

//Render drink
function renderDrink(drink) {
	//Ensure that all drink objects have the latest data before rendering
	updateData()

	//Grab the list that drinks will be rendered to
	const template = document.querySelector("#drink-template")
	const container = document.querySelector("#container")

	//Grab the individual elements used in rendering
	const templateClone = template.content.cloneNode(true)
	const drinkContainer = templateClone.querySelector("#drink-card")
	const standards = templateClone.querySelector("#standards")
	const burnStartDatetime = templateClone.querySelector("#burn_start-datetime")
	const finishedDatetime = templateClone.querySelector("#finished-datetime")
	const burnedDatetime = templateClone.querySelector("#burned-datetime")
	const drinkButton = templateClone.querySelector("#mark-drunk")
	const deleteButton = templateClone.querySelector("#delete-drink")
	const smallDeleteButton = templateClone.querySelector("#small-delete-drink")
	const progressBar = templateClone.querySelector("#progress")

	//Add a 'drunk' class to a drink-card if that drink has been drunk
	drink.isDrunk ? drinkContainer.classList.add("drunk") : ""

	//Remove the 'delete' button from the element if it has been marked as drunk
	if (drinkContainer.classList.contains("drunk")) {
		progressBar.value = drink.percentBurned
		drinkContainer.classList.contains("drunk") ? deleteButton.remove() : ""
		drinkButton.remove()
	} else {
		progressBar.remove()
		smallDeleteButton.remove()
	}

	//Set the data element drinkId to the same as the object drinkID
	drinkContainer.dataset.drinkId = drink.drinkID

	//Render the number of standards
	standards.innerText = `${drink.standards}x standards`

	finishedDatetime.innerText = drink.completeDatetime
		? `Drunk by ${timeConverter(drink.completeDatetime)}`
		: ""

	burnStartDatetime.innerText = drink.burnStartDatetime
		? `Starts burning at ${timeConverter(drink.burnStartDatetime)}`
		: ""

	burnedDatetime.innerText = drink.predictedBurnDatetime
		? `Burned by ${timeConverter(drink.predictedBurnDatetime)}`
		: ""

	//Render the element to the DOM
	container.appendChild(templateClone)
}

//Calculation functions

//Calculate the number of standards in a drink
function standardsCalculator(volumeName, percentage) {
	const drinkSizeMapping = [
		{ name: "pint-570", volume: 570 },
		{ name: "schooner-425", volume: 425 },
		{ name: "pot-285", volume: 285 },
		{ name: "can-375", volume: 375 },
		{ name: "can-355", volume: 355 },
		{ name: "can-330", volume: 330 },
		{ name: "shot-30", volume: 30 }
	]

	const volume = drinkSizeMapping.find((element) => element.name == volumeName)
		.volume

	if (percentage == ".") return
	//Return the number of standards rounded to 1 decimal place
	return ((volume / 1000) * percentage * 0.789).toFixed(1)
}

//Calculate the time taken to burn off the alcohol in a drink
function timeToBurn(standards) {
	return standards * 60 * 60 * 1000
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
	const drink = drinks.find((d) => d.drinkID == drinkElement.dataset.drinkId)
	//Remove the drink-card element
	drinkElement.remove()
	//Update the array to not include the drink
	drinks = drinks.filter((d) => d.drinkID != drink.drinkID)
}

//Utility/helper functions
//Creates 12 hour time strings from datetime integers
function timeConverter(dateTime) {
	dateTime = new Date(dateTime)

	if (new Date().getDay() != dateTime.getDay()) {
		return `${dateTime.toLocaleTimeString(["en-AU"], {
			timeStyle: "short"
		})} on ${dateTime.toLocaleDateString(["en-AU"], {
			weekday: "long"
		})}`
	} else {
		return dateTime.toLocaleTimeString(["en-AU"], {
			timeStyle: "short"
		})
	}
}

//Simple function to run other functions that update the Drink objects and then save that data
//FIX
//This needs optimising, it's currently running multiple times per refresh
//I thiink it's something to do with functions running on eventListener generation
function updateData() {
	drinks.forEach(alcoholRemaining)
	drinkQueue()
	saveDrinks()
	loadDrinks()
	console.log("Data updated")
}

//Simple function to run other functions that render the DOM
function renderData() {
	container.innerHTML = ""
	drinks.forEach(renderDrink)
	renderStats()
}

//Build a system to calculate the amount of alcohol still in someone's system
function standardsInSystem() {
	completedAndUnburnedDrinks = drinks.filter(
		(drink) => drink.isDrunk == true && drink.isBurned == false
	)
	const output = completedAndUnburnedDrinks.reduce((total, drink) => {
		return total + parseFloat(drink.standardsRemaining)
	}, 0)

	const drinkBurnTimes = drinks
		.filter((drink) => drink.predictedBurnDatetime)
		.map((drink) => drink.predictedBurnDatetime)

	let latestBurnTime

	if (drinkBurnTimes.length > 0) {
		latestBurnTime = drinkBurnTimes.reduce((a, b) => Math.max(a, b))
	} else {
		latestBurnTime = new Date().getTime()
	}

	return {
		standardsInSystem: output.toFixed(2),
		gramsInSystem: output * 10,
		timeTillAllClear: output * 60 * 60 * 1000,
		allClearTime: latestBurnTime
	}
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
//Redesign drink card
//Fix all absolute positionining
//Handle every standard iphone screen size
//Replace pixel widths with relative widths
