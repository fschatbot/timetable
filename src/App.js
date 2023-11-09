import React, { createContext, useContext, useEffect, useRef, useState } from "react";
import "./App.css";
import "./daisyUI.css";
import ResponseData from "./api/timetable.json";
import NextSeven from "./api/NextSeven.json";
import FuzzySearch from "fuzzy-search";

const SlotContext = createContext(null);

const DBTable = ResponseData.r.dbiAccessorRes.tables;
const Lessons = DBTable.find((table) => table.id === "lessons").data_rows;
const Cards = DBTable.find((table) => table.id === "cards").data_rows;
// const lesson = (id) => Lessons.filter((data) => data.subjectid === id);
const Subjects = DBTable.find((table) => table.id === "subjects").data_rows.map((subject) => {
	let name = subject.name.split("-")[0].trim();
	let difficulty = subject.name.match(/[HS]L/) ? subject.name.match(/[HS]L/)[0] : undefined;
	let batch = subject.name.match(/\d/) ? Number(subject.name.match(/\d/)[0]) : undefined;
	let id = subject.id;
	return { name, difficulty, batch, id, fullName: subject.name, shortname: subject.short.replace(/(\S)-\s/, "$1 - ") };
});
// const Teachers = DBTable.find((table) => table.id === "teachers").data_rows.map(({ id, lastname, short }) => ({ id, lastname, short }));
const getLessonSchedule = (lessonid) => Cards.filter((card) => card.lessonid === Lessons.find((less) => less.subjectid === lessonid && less.classids.includes("-188")).id);

// Getting the day from NextSeven for today
function preset(preset, date) {
	const t = (e) => ("0" + e).slice(-2);
	return preset
		.replace(/MM/g, t(date.getMonth() + 1))
		.replace(/YYYY/g, date.getFullYear())
		.replace(/DD/g, t(date.getDate()));
}
let today = preset("DD/MM/YYYY", new Date());
let currDay = NextSeven.find((day) => day.date === today)?.day;

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
			<label className="full" htmlFor={subject.id}>
				{subject.name}
			</label>
			<span className="short">- {subject.shortname}</span>
		</div>
	);
}

function Search() {
	const searchRef = useRef(null);

	const searcher = new FuzzySearch(Subjects, ["shortname", "name"], { caseSensitive: false, sort: true });
	const [results, setResults] = useState([]);

	const updateResults = () => setResults(searcher.search(searchRef.current.value));

	return (
		<div className="searchContainer">
			<div className="searchBox">
				<input type="text" placeholder="Subject Name..." ref={searchRef} onChange={updateResults} />

				{searchRef.current?.value ? (
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
				) : (
					<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
						<path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
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
			{slots.map((slot) => {
				let subject = Subjects.find((subject) => subject.id === slot);
				// let name = subject.name.split(" ").length > 1 ? subject.name.replace(/[a-z\s]/g, "") : subject.name;
				// name = subject.difficulty || subject.batch ? name : subject.shortname;
				// console.log(subject.name, name, subject.shortname);
				return (
					<div className="chip" key={slot}>
						{subject.shortname}
					</div>
				);
			})}
		</div>
	);
}

const Periods = DBTable.find((table) => table.id === "periods").data_rows;
const Breaks = DBTable.find((table) => table.id === "breaks").data_rows;
const Heading = [...Periods, ...Breaks].sort((a, b) => a.starttime.split(":")[0] * 60 + +a.starttime.split(":")[1] - (b.starttime.split(":")[0] * 60 + +b.starttime.split(":")[1])); // The item.startTime should be greater than the previous items.endTime;

function Table() {
	const { slots } = useContext(SlotContext);

	const [table, setTable] = useState([]);

	useEffect(() => {
		let newTable = [];

		slots.forEach((id) => {
			getLessonSchedule(id).forEach((less) => {
				newTable.push({ ...less, day: less.days.indexOf("1") + 1, period: +less.period, getID: id, subject: Subjects.find((subject) => subject.id === id) });
			});
		});

		setTable(newTable);
	}, [slots]);

	return (
		<table>
			<thead>
				<tr>
					<th></th>
					{Heading.map((head) => (
						<th key={head.starttime}>
							<h1>{head.name}</h1>
							<span>
								{head.starttime} - {head.endtime}
							</span>
						</th>
					))}
				</tr>
			</thead>
			{<TableBody table={table} />}
		</table>
	);
}

function TableBody({ table }) {
	const rowNames = DBTable.find((table) => table.id === "days").data_rows.map((x) => x.name);

	return (
		<tbody>
			{rowNames.map((rowName, day) => (
				<tr key={day} className={`Day ${currDay}` === rowName ? "active" : undefined}>
					<th>{rowName}</th>
					{Heading.map((head, colIndex) => {
						const tdKey = `${day},${colIndex}`;
						if (head.break) return <td className="break" key={tdKey}></td>;
						const lessons = table.filter((lesson) => lesson.day === day + 1 && lesson.period === +head.period);
						if (lessons.length === 0) return <td key={tdKey}>-</td>;

						const subjElem = lessons.map((lesson) => lesson.subject.shortname).join(" / ");

						return (
							<td key={tdKey}>
								<div className="sizing">
									<span>{subjElem}</span>
								</div>
								<div className="asthetic">
									<span>{subjElem}</span>
								</div>
							</td>
						);
					})}
				</tr>
			))}
		</tbody>
	);
}

function Warning() {
	return (
		<div className="alert">
			<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" className="stroke-info flex-shrink-0 w-6 h-6">
				<path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
			</svg>
			<span>Subject names change in backend occasionally. This may cause the subject selected above to be affected!</span>
		</div>
	);
}

function getStroageSlots() {
	const StrSlots = localStorage.getItem("timtable") || "-122|-104|-112|-103|-79|*31";
	const slots = StrSlots.split("|");

	slots.forEach((slot, i) => {
		if (!Subjects.find((subject) => subject.id === slot)) {
			console.log("Invalid Slot ID:", slot);
			// Remove the slot from the array
			slots.splice(i, 1);
		}
	});

	return slots;
}

function App() {
	const [slots, setSlots] = useState(getStroageSlots());

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
			<h1 className="text-2xl font-bold text-white mt-10">Grade 11 TimeTable</h1>
			<Table />
			<Warning />
		</SlotContext.Provider>
	);
}

export default App;
