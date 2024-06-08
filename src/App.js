import React, { createContext, useContext, useEffect, useRef, useState } from "react";
import "./App.css";
import "./daisyUI.css";
import FuzzySearch from "fuzzy-search";

const SlotContext = createContext(null);

const apiUrl = process.env.NODE_ENV === "development" ? "./timetable/api" : "./api";
const ResponseData = await fetch(`${apiUrl}/timetable.json`).then((res) => res.json());
const NextSeven = await fetch(`${apiUrl}/NextSeven.json`).then((res) => res.json());

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
const Classes = DBTable.find((table) => table.id === "classes").data_rows.reduce((acc, classData) => ({ ...acc, [classData.name.toLowerCase().trim()]: classData.id }), {});
const Teachers = DBTable.find((table) => table.id === "teachers").data_rows.map(({ id, lastname, short }) => ({ id, lastname, short }));
const getLessonSchedule = (lessonid) => {
	const classID = localStorage.getItem("grade") === "1" ? Classes["grade 11"] : Classes["grade 12"];
	let lessons = Lessons.filter((less) => less.subjectid === lessonid && less.classids.includes(classID)).map((less) => less.id);
	return Cards.filter((card) => lessons.includes(card.lessonid));
};

if (process.env.NODE_ENV === "development") {
	const variables = { ResponseData, NextSeven, DBTable, Lessons, Cards, Subjects, Teachers, getLessonSchedule, Classes };
	for (let key in variables) window[key] = variables[key];
	console.log("%cDevelopment Mode Detected! Variables Exposed!", "color: cyan");
}

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
let Upcoming = NextSeven.filter((day) => new Date(day.date) > new Date())[0]?.day;

function Result({ subject }) {
	const { slots, removeSlot, addSlot } = useContext(SlotContext);

	return (
		<div className="result">
			<input
				type="checkbox"
				className="checkbox checkbox-sm"
				defaultChecked={slots.includes(subject.shortname)}
				name={subject.name}
				id={subject.id}
				onChange={() => {
					if (slots.includes(subject.shortname)) {
						removeSlot(subject.shortname);
					} else {
						addSlot(subject.shortname);
					}
				}}
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
				let subject = Subjects.find((subject) => subject.shortname === slot);
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
const Breaks = DBTable.find((table) => table.id === "breaks").data_rows.map((data) => {
	data.break = true;
	return data;
});
const Heading = [...Periods, ...Breaks].sort((a, b) => a.starttime.split(":")[0] * 60 + +a.starttime.split(":")[1] - (b.starttime.split(":")[0] * 60 + +b.starttime.split(":")[1])); // The item.startTime should be greater than the previous items.endTime;

function Table() {
	const { slots } = useContext(SlotContext);

	const [table, setTable] = useState([]);

	useEffect(() => {
		let newTable = [];

		slots.forEach((name) => {
			const sub = Subjects.find((subject) => subject.shortname === name);
			getLessonSchedule(sub.id).forEach((less) => {
				newTable.push({ ...less, day: less.days.indexOf("1") + 1, period: +less.period, getID: sub.id, subject: Subjects.find((subject) => subject.id === sub.id) });
			});
		});

		setTable(newTable);
	}, [slots]);

	return (
		<table>
			<thead>
				<tr>
					<th className="align-bottom">Next: D{Upcoming || "#"}</th>
					{Heading.map((head) => (
						<th key={head.starttime}>
							<h1>{head.short}</h1>
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
						const Llessons = table.filter((lesson) => lesson.day === day + 1 && lesson.period === +head.period - 1);
						const lessons = table.filter((lesson) => lesson.day === day + 1 && lesson.period === +head.period);
						const Nlessons = table.filter((lesson) => lesson.day === day + 1 && lesson.period === +head.period + 1);
						if (lessons.length === 0) return <td key={tdKey}>-</td>;

						const LsubjElem = Llessons.map((lesson) => lesson.subject.shortname).join(" / ");
						const subjElem = lessons.map((lesson) => lesson.subject.shortname).join(" / ");
						const NsubjElem = Nlessons.map((lesson) => lesson.subject.shortname).join(" / ");

						// If next slot is equal to this slot then increase the colspan
						// If last slot is equal to this slot then no render as its already rendered as a bigger block
						return LsubjElem === subjElem ? undefined : (
							<td key={tdKey} colSpan={NsubjElem === subjElem ? 2 : 1}>
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
	const StrSlots = localStorage.getItem(`timetable-G1${localStorage.getItem("grade") || 1}`) || "ST|Club|Playtime|TOK|PS|EE";
	const slots = StrSlots.split("|");
	const newSlots = [];

	slots.forEach((slot, i) => {
		let subject = Subjects.find((subject) => subject.id === slot || subject.shortname === slot);
		if (!subject) {
			console.log("Invalid Slot ID:", slot);
		} else if (subject.id === slot) {
			newSlots.push(subject.shortname); // Legacy Support
		} else newSlots.push(slot);
	});
	if (process.env.NODE_ENV === "development") console.log(newSlots);
	newSlots.sort();

	return newSlots;
}

function GradeSelector() {
	const grade = localStorage.getItem("grade") || 1;
	const setGrade = (grade) => {
		localStorage.setItem("grade", grade);
		window.location.reload();
	};

	return (
		<div className="gradeSelector">
			<button onClick={() => setGrade(1)}>Grade 11</button>
			<button onClick={() => setGrade(2)}>Grade 12</button>
			<div className="selector" data-grade={grade} />
		</div>
	);
}

function App() {
	const [slots, setSlots] = useState(getStroageSlots());

	useEffect(() => {
		localStorage.setItem(`timetable-G1${localStorage.getItem("grade") || 1}`, slots.join("|"));
	}, [slots]);

	const addSlot = (id) => setSlots((prev) => [...prev, id]);
	const removeSlot = (id) => setSlots((prev) => prev.filter((slot) => slot !== id));

	return (
		<SlotContext.Provider value={{ slots, setSlots, addSlot, removeSlot }}>
			<h1 className="text-3xl font-bold text-white">Timetable Generator</h1>
			<div className="flex flex-row mt-5 gap-2">
				<GradeSelector />
				<Search />
			</div>
			<Chips />
			<h1 className="text-2xl font-bold text-white mt-10">Grade 1{localStorage.getItem("grade") || 1} TimeTable</h1>
			<Table />
			<Warning />
		</SlotContext.Provider>
	);
}

export default App;
