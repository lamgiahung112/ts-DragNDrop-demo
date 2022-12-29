//#region Validator
interface Validatable {
	value: string | number
	required?: boolean
	minLength?: number
	maxLength?: number
	min?: number
	max?: number
}

function isValid(input: Validatable): boolean {
	let isValidInput = true

	if (input.required) {
		isValidInput = isValidInput && input.value.toString().trim().length !== 0
	}

	if (input.minLength != null && typeof input.value === "string") {
		isValidInput = isValidInput && input.value.length >= input.minLength
	}

	if (input.maxLength != null && typeof input.value === "string") {
		isValidInput = isValidInput && input.value.length <= input.maxLength
	}

	if (input.min != null && typeof input.value === "number") {
		isValidInput = isValidInput && input.value >= input.min
	}

	if (input.max != null && typeof input.value === "number") {
		isValidInput = isValidInput && input.value <= input.max
	}

	return isValidInput
}

//#endregion

//#region Decorators
function autobind(_: any, __: string, descriptor: PropertyDescriptor) {
	const originalMethod = descriptor.value
	const adjDescriptor: PropertyDescriptor = {
		configurable: true,
		get() {
			return originalMethod.bind(this)
		},
	}

	return adjDescriptor
}

//#endregion

//#region Drag & Drops Interfaces
interface Draggable {
	dragStartHandler(event: DragEvent): void
	dragEndHandler(event: DragEvent): void
}

interface DragTarget {
	dragOverHandler(event: DragEvent): void
	dropHandler(event: DragEvent): void
	dragLeaveHandler(event: DragEvent): void
}
//#endregion

//#region Component base class
abstract class Component<T extends HTMLElement, U extends HTMLElement> {
	templateElement: HTMLTemplateElement
	hostElement: T
	element: U

	constructor(
		templateId: string,
		hostElementId: string,
		insertAtStart: boolean,
		newElementId?: string
	) {
		this.templateElement = document.getElementById(templateId)! as HTMLTemplateElement
		this.hostElement = document.getElementById(hostElementId)! as T

		const importedNode = document.importNode(this.templateElement.content, true)
		this.element = importedNode.firstElementChild as U

		if (newElementId) {
			this.element.id = newElementId
		}

		this.attach(insertAtStart)
	}

	private attach(insertAtStart: boolean) {
		this.hostElement.insertAdjacentElement(
			insertAtStart ? "afterbegin" : "beforeend",
			this.element
		)
	}

	abstract configure(): void
	abstract renderContent(): void
}
//#endregion

//#region Project

enum ProjectStatus {
	Active,
	Finished,
}

class Project {
	constructor(
		public id: string,
		public title: string,
		public description: string,
		public people: number,
		public status: ProjectStatus
	) {}
}

//#endregion

//#region ProjectInput class
class ProjectInput extends Component<HTMLDivElement, HTMLFormElement> {
	titleInput: HTMLInputElement
	descriptionInput: HTMLInputElement
	peopleInput: HTMLInputElement

	constructor() {
		super("project-input", "app", true, "user-input")

		this.titleInput = this.element.querySelector("#title") as HTMLInputElement
		this.descriptionInput = this.element.querySelector(
			"#description"
		) as HTMLInputElement
		this.peopleInput = this.element.querySelector("#people") as HTMLInputElement

		this.configure()
		this.renderContent()
	}

	configure() {
		this.element.addEventListener("submit", this.submitHandler)
	}

	renderContent() {
		"ok"
	}

	private gatherUserInput(): [string, string, number] | void {
		const enteredTitle = this.titleInput.value
		const enteredDescription = this.descriptionInput.value
		const enteredPeople = this.peopleInput.value

		const titleValidatable: Validatable = {
			value: enteredTitle,
			required: true,
		}

		const descriptionValidatable: Validatable = {
			value: enteredDescription,
			required: true,
			minLength: 5,
		}

		const peopleValidatable: Validatable = {
			value: enteredPeople,
			min: 1,
			max: 10,
		}

		if (
			!isValid(titleValidatable) ||
			!isValid(descriptionValidatable) ||
			!isValid(peopleValidatable)
		) {
			alert("Invalid Input")
		} else {
			return [enteredTitle, enteredDescription, +enteredPeople]
		}
	}

	private clearInputs() {
		this.titleInput.value = ""
		this.descriptionInput.value = ""
		this.peopleInput.value = ""
	}

	@autobind
	private submitHandler(event: Event) {
		event.preventDefault()
		const userInput = this.gatherUserInput()

		if (Array.isArray(userInput)) {
			const [title, description, people] = userInput
			projectState.addProject(title, description, people)
			this.clearInputs()
		}
	}
}
//#endregion

//#region ProjectList class
class ProjectList extends Component<HTMLDivElement, HTMLElement> implements DragTarget {
	assignedProjects: Project[]

	constructor(private type: "active" | "finished") {
		super("project-list", "app", false, `${type}-projects`)

		this.assignedProjects = []
		this.configure()
		this.renderContent()
	}

	private renderProjects() {
		const listElement = document.getElementById(`${this.type}-projects-list`)!
		listElement.innerHTML = ""
		for (const prjItem of this.assignedProjects) {
			new ProjectItem(this.element.querySelector("ul")!.id, prjItem)
		}
	}

	@autobind
	dragOverHandler(event: DragEvent): void {
		if (event.dataTransfer && event.dataTransfer.types[0] === "text/plain") {
			event.preventDefault()
			const listElement = this.element.querySelector("ul")!
			listElement.classList.add("droppable")
		}
	}

	@autobind
	dropHandler(event: DragEvent): void {
		const prjId = event.dataTransfer!.getData("text/plain")
		projectState.moveProject(
			prjId,
			this.type === "active" ? ProjectStatus.Active : ProjectStatus.Finished
		)
	}

	@autobind
	dragLeaveHandler(_: DragEvent): void {
		const listElement = this.element.querySelector("ul")!
		listElement.classList.remove("droppable")
	}

	configure() {
		this.element.addEventListener("dragover", this.dragOverHandler)
		this.element.addEventListener("dragleave", this.dragLeaveHandler)
		this.element.addEventListener("drop", this.dropHandler)

		projectState.addListener((projects: Project[]) => {
			const projToRender = projects.filter(
				(prj) =>
					(prj.status === ProjectStatus.Active && this.type === "active") ||
					(prj.status === ProjectStatus.Finished && this.type === "finished")
			)
			this.assignedProjects = projToRender
			this.renderProjects()
		})
	}

	renderContent() {
		const listId = `${this.type}-projects-list`
		this.element.querySelector("ul")!.id = listId
		this.element.querySelector("h2")!.textContent =
			this.type.toUpperCase() + " PROJECTS"
	}
}
//#endregion

//#region Project State

type Listener<T> = (items: T[]) => void

class State<T> {
	protected listeners: Listener<T>[] = []

	addListener(fnc: Listener<T>) {
		this.listeners.push(fnc)
	}
}

class ProjectState extends State<Project> {
	private projects: Project[] = []
	private static instance: ProjectState

	private constructor() {
		super()
	}

	static getInstance() {
		if (!this.instance) this.instance = new ProjectState()
		return this.instance
	}

	addProject(title: string, description: string, numOfPeople: number) {
		const newProj = new Project(
			Math.random().toString(),
			title,
			description,
			numOfPeople,
			ProjectStatus.Active
		)
		this.projects.push(newProj)
		this.triggerListeners()
	}

	moveProject(projectId: string, newStatus: ProjectStatus) {
		const foundPrj = this.projects.find((x) => x.id === projectId)
		if (foundPrj && foundPrj.status !== newStatus) {
			foundPrj.status = newStatus
			this.triggerListeners()
		}
	}

	private triggerListeners() {
		for (const listenerFnc of this.listeners) {
			listenerFnc([...this.projects])
		}
	}
}

//#endregion

//#region Project Item
class ProjectItem
	extends Component<HTMLUListElement, HTMLLIElement>
	implements Draggable
{
	get persons() {
		if (this.project.people === 1) {
			return "1 person"
		}
		return `${this.project.people} persons`
	}

	constructor(hostId: string, private project: Project) {
		super("single-project", hostId, false, project.id)

		this.configure()
		this.renderContent()
	}

	@autobind
	dragStartHandler(event: DragEvent): void {
		event.dataTransfer!.setData("text/plain", this.project.id)
		event.dataTransfer!.effectAllowed = "move"
	}

	@autobind
	dragEndHandler(_: DragEvent): void {}

	configure(): void {
		this.element.addEventListener("dragstart", this.dragStartHandler)
		this.element.addEventListener("dragend", this.dragEndHandler)
	}

	renderContent(): void {
		this.element.querySelector("h2")!.textContent = this.project.title
		this.element.querySelector("h3")!.textContent = this.persons + " assigned"
		this.element.querySelector("p")!.textContent = this.project.description
	}
}
//#endregion

const projectState = ProjectState.getInstance()
const projectInput = new ProjectInput()
const activeProjectList = new ProjectList("active")
const finishedProjectList = new ProjectList("finished")
