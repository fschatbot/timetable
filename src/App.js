import React, { createContext, useContext, useEffect, useRef, useState } from "react";
import "./App.css";
import "./daisyUI.css";
import ResponseData from "./data.json";
import FuzzySearch from "fuzzy-search";

const SlotContext = createContext(null);

const DBTable = ResponseData.r.dbiAccessorRes.tables;
const Lessons = DBTable.find((table) => table.id === "lessons").data_rows;
const Cards = DBTable.find((table) => table.id === "cards").data_rows;
const lesson = (id) => Lessons.filter((data) => data.subjectid === id);
const Subjects = DBTable.find((table) => table.id === "subjects").data_rows.map((subject) => {
	let name = subject.name.split("-")[0].trim();
	let difficulty = (subject.name.match(/[HS]L/) || ["SL"])[0];
	let batch = Number((subject.name.match(/\d/) || ["1"])[0]);
	let id = subject.id;
	return { name, difficulty, batch, id, fullName: subject.name, shortname: subject.short };
});
const Teachers = DBTable.find((table) => table.id === "teachers").data_rows.map(({ id, lastname, short }) => ({ id, lastname, short }));
const getLessonSchedule = (lessonid) => Cards.filter((card) => card.lessonid === Lessons.find((less) => less.subjectid === lessonid && less.classids.includes("-188")).id);

function Result({ subject }) {
	const { slots, removeSlot, addSlot } = useContext(SlotContext);

	return (
		<div className="result">
			<input
				type="checkbox"
				className="checkbox checkbox-sm"
				defaultChecked={slots.includes(subject.id)}
				name={subject.name}
				id={subject.id}
				onChange={() => (slots.includes(subject.id) ? removeSlot(subject.id) : addSlot(subject.id))}
			/>
			<label className="full" for={subject.id}>
				{subject.name}
			</label>
			<span className="short">- {subject.shortname}</span>
		</div>
	);
}

function Search() {
	const searchRef = useRef(null);

	const searcher = new FuzzySearch(Subjects, ["name", "shortname"], { caseSensitive: false, sort: true });
	const [results, setResults] = useState([]);

	const updateResults = () => setResults(searcher.search(searchRef.current.value));

	return (
		<div className="searchContainer">
			<div className="searchBox">
				<input type="text" placeholder="Subject Name" ref={searchRef} onChange={updateResults} />
				{searchRef.current?.value && (
					<svg
						xmlns="http://www.w3.org/2000/svg"
						fill="none"
						viewBox="0 0 24 24"
						strokeWidth={1.5}
						stroke="currentColor"
						onClick={() => {
							searchRef.current.value = "";
							updateResults();
						}}>
						<path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
					</svg>
				)}
			</div>

			{searchRef.current?.value && (
				<div className="results">
					{results.slice(0, 5).map((subject) => (
						<Result subject={subject} key={subject.id} />
					))}
				</div>
			)}
		</div>
	);
}

function Chips() {
	const { slots } = useContext(SlotContext);

	return (
		<div className="chips">
			{slots.map((slot) => (
				<div className="chip" key={slot}>
					{Subjects.find((subject) => subject.id === slot).shortname}
				</div>
			))}
		</div>
	);
}

function App() {
	const [slots, setSlots] = useState(localStorage.getItem("timtable")?.split("|") || []);

	useEffect(() => {
		localStorage.setItem("timtable", slots.join("|"));
	}, [slots]);

	const addSlot = (id) => setSlots((prev) => [...prev, id]);
	const removeSlot = (id) => setSlots((prev) => prev.filter((slot) => slot !== id));

	return (
		<SlotContext.Provider value={{ slots, setSlots, addSlot, removeSlot }}>
			<h1 className="text-3xl font-bold text-white">Timetable Generator</h1>
			<Search />
			<Chips />
		</SlotContext.Provider>
	);
}

export default App;
