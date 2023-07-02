import React, { createContext, useContext, useState } from "react";
import "./App.css";
import ResponseData from "./data.json";

const SlotContext = createContext(null);

const url = "https://crossorigin.me" + encodeURIComponent("https://fountainheadschool.edupage.org/timetable/server/regulartt.js?__func=regularttGetData");

const DBTable = ResponseData.r.dbiAccessorRes.tables;

function Search() {
	const { slots, setSlots } = useContext(SlotContext);

	console.log(DBTable);
}

function App() {
	const [slots, setSlots] = useState([]);
	return (
		<SlotContext.Provider value={{ slots, setSlots }}>
			<h1 className="text-3xl font-bold underline">A simple Timetable generator for school</h1>;
		</SlotContext.Provider>
	);
}

export default App;
