//Global variables
const object = document.querySelector("#object-list")

const form = document.querySelector("#form")
const volumeInput = document.querySelector("#volume-input")
const percentageInput = document.querySelector("#percentage-input")
const standardsEstimatorStandards = document.querySelector(
	"#standards-estimator-standards"
)
const acknowledgeDisclaimerButton = document.querySelector(
	"#acknowledge-disclosure"
)

const LOCAL_STORAGE_PREFIX = "DRINK_TRACK"
const DRINKS_STORAGE_KEY = `${LOCAL_STORAGE_PREFIX}-drinks`
const PREFERENCES_STORAGE_KEY = `${LOCAL_STORAGE_PREFIX}-preferences`

const drinkSizeMapping = [
	{ name: "pint-570", volume: 570, shortName: "pint" },
	{ name: "schooner-425", volume: 425, shortName: "schooner" },
	{ name: "pot-285", volume: 285, shortName: "pot" },
	{ name: "can-375", volume: 375, shortName: "can" },
	{ name: "can-355", volume: 355, shortName: "can" },
	{ name: "can-330", volume: 330, shortName: "can" },
	{ name: "shot-30", volume: 30, shortName: "shot" }
]

let preferences = loadPreferences()
let drinks = loadDrinks()

drinks.forEach(renderDrink)
updateData()
renderData()
setTheme()
renderAcknowledgeDisclaimer()

// Rerender the data every 20 seconds
// This is a terrible idea
// Absolutely need to implement a better solution than this
setInterval(() => {
	renderData()
}, 20000)

//Preferences-related event listeners and functions

function renderAcknowledgeDisclaimer() {
	loadPreferences()
	const disclosureContainer = document.querySelector(".disclosure-container")
	const daysSinceDisclosureAcknowledged = Math.floor(
		(new Date().getTime() - preferences.disclosureAcknowledgedDatetime) /
			1000 / //Seconds
			60 / //Minutes
			60 //Hours
	)

	if (
		preferences.disclosureAcknowledged == true &&
		daysSinceDisclosureAcknowledged < 7
	) {
		disclosureContainer.style.display = "none"
	}
	savePreferences()
}

acknowledgeDisclaimerButton.addEventListener("click", () => {
	preferences.disclosureAcknowledged = true
	preferences.disclosureAcknowledgedDatetime = new Date().getTime()
	renderAcknowledgeDisclaimer()
})

//Theme functions
function chooseTheme(themeName) {
	loadPreferences()

	preferences.themeName = themeName
	savePreferences()
	setTheme()
}

function setTheme() {
	//Set dark as the default theme
	const themeName = loadPreferences().themeName || "Dark"

	//FIXME
	const body = document.querySelector("body")
	const lightTheme = document.querySelector("#Light")
	lightTheme.classList.remove("selected-theme")
	const darkTheme = document.querySelector("#Dark")
	darkTheme.classList.remove("selected-theme")

	const selectedTheme = document.querySelector(`#${themeName}`)
	selectedTheme.classList.toggle("selected-theme")
	body.className = themeName
}

document.addEventListener("click", (e) => {
	if (!e.target.classList.contains("theme")) return

	selectedItem = e.target.innerText
	chooseTheme(selectedItem)
	console.log(document.querySelector("body"))
})

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
		this.completeDatetime = ""
		this.burnStartDatetime = ""
		this.burnedDatetime = ""
		this.timeToBurn = timeToBurn(this.standards)
	}
}

function drinkQueue() {
	//Create an array of drinks sorted from oldest started to newest started
	const sortedArray = drinks.sort((a, b) => {
		if (a.logDatetime < b.logDatetime) {
			return -1
		}
		if (a.logDatetime > b.logDatetime) {
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
			earliestBurnStart = drink.logDatetime

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

	//Sort drinks by complete time
	//This is so that incomplete drinks show at the top
	//And complete drinks are below that
	//Makes for easier completing of drinks/seeing which drink is next to finish
	const outputArray = sortedArray.sort((a, b) => {
		if (a.completeDatetime < b.completeDatetime) {
			return -1
		}
		if (a.completeDatetime > b.completeDatetime) {
			return 1
		} else return 0
	})
	//Save the array
	drinks = outputArray
}

//Calculate the amount of time until a given drink is burned off
function alcoholRemaining(drink) {
	//Short circuit if the drink has not been completed
	// if (drink.isDrunk == false) return "Drink not completed"

	const currentTime = new Date().getTime()
	const timeSinceStarted = currentTime - drink.logDatetime
	const timeTillBurned = currentTime + drink.timeToBurn

	let percentBurned
	if (timeSinceStarted / drink.timeToBurn > 1) {
		percentBurned = 1
	} else {
		percentBurned = timeSinceStarted / drink.timeToBurn
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

//Event listener to add an 'another round' drink to the drinks storage array
document.addEventListener("click", (e) => {
	if (!e.target.matches("#another-round-button")) return

	lastDrink = anotherRound().lastDrink
	drink = new Drink(lastDrink.volume, lastDrink.percentage)

	drinks.unshift(drink)

	updateData()
	renderData()
})

//Function to delete on confirm delete
//Set as a named function so that it is removable
function confirmDelete(e) {
	if (!e.target.classList.contains("delete-confirm")) return
	const DOMDrink = e.target.closest("#drink-card")

	e.target.closest("#drink-card").classList.add("deleted")

	setTimeout(() => {
		deleteDrink(DOMDrink)
		updateData()
		renderData()
	}, 250)
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

	const DOMDrink = e.target.closest("#drink-card")

	e.target.closest("#drink-card").classList.add("deleted")

	setTimeout(() => {
		deleteDrink(DOMDrink)
		updateData()
		renderData()
	}, 150)
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
	const minutesToBurn = Math.floor(
		timeToBurn(standards) / 1000 / 60 - hoursToBurn * 60
	)
	const addDrinkTitle = document.querySelector("#add-drink-title")
	const standardsEstimatorStandardsSubtitle = document.querySelector(
		"#standards-estimator-subtitle"
	)

	if (volume && percentage) addDrinkTitle.classList.add("shrunk")

	//Run this through an if statement so that it only slows down on the first render
	function updateStandardsEstimator() {
		standardsEstimatorStandards.innerText = `${standards}x Standards`
		if (hoursToBurn > 0) {
			standardsEstimatorStandardsSubtitle.innerText = `${hoursToBurn} hours and ${minutesToBurn} minutes to burn`
		} else {
			standardsEstimatorStandardsSubtitle.innerText = `${minutesToBurn} minutes to burn`
		}
	}

	//Set a very small delay so that the title has time to animate
	if (!volume && !percentage) {
		setTimeout(() => {
			updateStandardsEstimator()
		}, 200)
	} else {
		updateStandardsEstimator()
	}
}

//Render the 'another round' card
function anotherRound() {
	const anotherRoundContainer = document.querySelector(
		".another-round-container"
	)
	const anotherRoundABV = document.querySelector("#another-round-abv")
	const anotherRoundStandards = document.querySelector(
		"#another-round-standards"
	)

	if (drinks.length < 1) {
		anotherRoundContainer.style.display = "none"
		return
	}

	const drinkLogDatetimes = drinks.map((drink) => drink.logDatetime)
	let lastDrinkLogDatetime
	if (drinkLogDatetimes.length > 0) {
		lastDrinkLogDatetime = drinkLogDatetimes.reduce((a, b) => Math.max(a, b))
	} else {
		lastDrinkLogDatetime = drinkLogDatetimes[0]
	}
	const lastDrink = drinks.find(
		(drink) => drink.logDatetime == lastDrinkLogDatetime
	)
	const lastDrinkName = drinkSizeMapping.find(
		(drink) => drink.name == lastDrink.volume
	).shortName

	if (drinks.length < 1) {
		anotherRoundContainer.style.display = "none"
	} else {
		anotherRoundContainer.style.display = "flex"
		anotherRoundABV.innerText = `A ${lastDrinkName} of ${lastDrink.percentage}%`
		anotherRoundStandards.innerText = `${lastDrink.standards}x standards`
	}

	return { lastDrink: lastDrink, lastDrinkName: lastDrinkName }
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
		activeStandards.style.fontSize = "36px"
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
		activeStandards.style.fontSize = "48px"
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

	const minutesSinceStartedString =
		Math.floor((new Date().getTime() - drink.logDatetime) / 1000 / 60) == 1
			? "minute"
			: "minutes"

	finishedDatetime.innerText = drink.isDrunk
		? `Finished in ${Math.floor(
				(drink.completeDatetime - drink.logDatetime) / 1000 / 60
		  )} ${minutesSinceStartedString}`
		: `Started ${Math.floor(
				(new Date().getTime() - drink.logDatetime) / 1000 / 60
		  )} ${minutesSinceStartedString} ago`

	burnStartDatetime.innerText = drink.burnStartDatetime
		? `Starts burning at ${timeConverter(drink.burnStartDatetime)}`
		: ""

	burnedDatetime.innerText = drink.predictedBurnDatetime
		? `Burned off by ${timeConverter(drink.predictedBurnDatetime)}`
		: ""

	//Render the element to the DOM
	container.appendChild(templateClone)
}

//Calculation functions

//Calculate the number of standards in a drink
function standardsCalculator(volumeName, percentage) {
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

function loadPreferences() {
	const preferencesString = localStorage.getItem(PREFERENCES_STORAGE_KEY)
	return JSON.parse(preferencesString) || {}
}

function savePreferences() {
	localStorage.setItem(PREFERENCES_STORAGE_KEY, JSON.stringify(preferences))
}

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
//FIXME
//This needs optimising, it's currently running multiple times per refresh
//I thiink it's something to do with functions running on eventListener generation
function updateData() {
	drinks.forEach(alcoholRemaining)
	drinkQueue()
	saveDrinks()
	loadDrinks()
}

//Simple function to run other functions that render the DOM
function renderData() {
	container.innerHTML = ""
	anotherRound()
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

//Activate and deactive side panel
//FIXME
//Need to lock scrolling when side panel is active
function disableSidePanel(e) {
	if (e.target.classList.contains("nav")) return
	const sidePanel = document.querySelector("#side-panel")
	const body = document.querySelector("body")
	sidePanel.classList.remove("active")
	// body.style.overflow = 'visible'
}

//FIXME
//Technically works but there's probably something
//more modern I can use than tbis structure
const screenWidth = screen.width
let touchStart
document.addEventListener("touchstart", (e) => {
	touchStart = e.touches[0].clientX
})

let touchEnd
document.addEventListener("touchmove", (e) => {
	touchEnd = e.touches[0].clientX
	handleMove(touchStart, touchEnd, screenWidth)
})

function handleMove(touchstart, touchEnd, screenWidth) {
	const delta = touchEnd - touchstart

	//If more than x% of the screen was swiped, trigger
	if (delta / screenWidth > 0.5) {
		const sidePanel = document.querySelector("#side-panel")

		document.removeEventListener("click", disableSidePanel)
		sidePanel.classList.add("active")
		document.addEventListener("click", disableSidePanel)
	}
}
