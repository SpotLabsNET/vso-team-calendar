﻿/// <reference path='../../typings/VSS.d.ts' />
/// <reference path='../../typings/fullCalendar/fullCalendar.d.ts' />
/// <reference path='../../typings/moment/moment.d.ts' />

import Calendar_ColorUtils = require("Calendar/Utils/Color");
import Calendar_Contracts = require("Calendar/Contracts");
import Calendar_Utils_Guid = require("Calendar/Utils/Guid");
import Controls = require("VSS/Controls");
import Q = require("q");
import Utils_Core = require("VSS/Utils/Core");
import Utils_Date = require("VSS/Utils/Date");
import Utils_String = require("VSS/Utils/String");

export interface CalendarOptions {
    fullCalendarOptions: IDictionaryStringTo<any>;
    viewRender: any;
}

export interface SourceAndOptions {
    source: Calendar_Contracts.IEventSource;
    options?: FullCalendar.EventSourceOptions;
    callbacks?: { [callbackType: number]: Function };
}

export interface CalendarEventSource {

    (source: Calendar_Contracts.IEventSource, options: FullCalendar.EventSourceOptions): void;

    eventSource: Calendar_Contracts.IEventSource;
    state?: CalendarEventSourceState;
}

export interface CalendarEventSourceState {
    dirty?: boolean;
    cachedEvents?: FullCalendar.EventObject[];
}

export enum FullCalendarCallbackType {
    // General display events
    viewRender,
    viewDestroy,
    dayRender,
    windowResize,

    // Clicking, hovering, selecting
    dayClick,
    eventClick,
    eventMouseover,
    eventMouseout,
    select,
    unselect,

    // Event rendering events
    eventRender,
    eventAfterRender,
    eventDestroy,
    eventAfterAllRender,

    // Dragging, dropping
    eventDragStart,
    eventDragStop,
    eventDrop,
    eventResizeStart,
    eventResizeStop,
    eventResize,
    drop,
    eventReceive
}

export enum FullCalendarEventRenderingCallbackType {

}

export class Calendar extends Controls.Control<CalendarOptions> {
    private _callbacks: { [callbackType: number]: Function[] };
    private _calendarSources: CalendarEventSource[];

    constructor(options: CalendarOptions) {
        super($.extend({ cssClass: "vss-calendar" }, options));
        this._callbacks = {};
        this._calendarSources = [];
    }

    public initialize() {
        super.initialize();

        //  Determine optimal aspect ratio
        var aspectRatio = $('.leftPane').width() /($('.leftPane').height() - 85);
        aspectRatio = parseFloat(aspectRatio.toFixed(1));

        this._element.fullCalendar($.extend({
            eventRender: this._getComposedCallback(FullCalendarCallbackType.eventRender),
            eventAfterRender: this._getComposedCallback(FullCalendarCallbackType.eventAfterRender),
            eventAfterAllRender: this._getComposedCallback(FullCalendarCallbackType.eventAfterAllRender),
            eventDestroy: this._getComposedCallback(FullCalendarCallbackType.eventDestroy),
            viewRender: (view: FullCalendar.View, element: JQuery) => this._viewRender(view, element),
            viewDestroy: this._getComposedCallback(FullCalendarCallbackType.viewDestroy),
            dayRender: this._getComposedCallback(FullCalendarCallbackType.dayRender),
            windowResize: this._getComposedCallback(FullCalendarCallbackType.windowResize),
            dayClick: this._getComposedCallback(FullCalendarCallbackType.dayClick),
            eventClick: this._getComposedCallback(FullCalendarCallbackType.eventClick),
            eventMouseover: this._getComposedCallback(FullCalendarCallbackType.eventMouseover),
            eventMouseout: this._getComposedCallback(FullCalendarCallbackType.eventMouseout),
            select: this._getComposedCallback(FullCalendarCallbackType.select),
            unselect: this._getComposedCallback(FullCalendarCallbackType.unselect),
            eventDragStart: this._getComposedCallback(FullCalendarCallbackType.eventDragStart),
            eventDragStop: this._getComposedCallback(FullCalendarCallbackType.eventDragStop),
            eventDrop: this._getComposedCallback(FullCalendarCallbackType.eventDrop),
            eventResizeStart: this._getComposedCallback(FullCalendarCallbackType.eventResizeStart),
            eventResizeStop: this._getComposedCallback(FullCalendarCallbackType.eventResizeStop),
            eventResize: this._getComposedCallback(FullCalendarCallbackType.eventResize),
            drop: this._getComposedCallback(FullCalendarCallbackType.drop),
            eventReceive: this._getComposedCallback(FullCalendarCallbackType.eventReceive),
            header: false,
            aspectRatio: aspectRatio,
            columnFormat: "dddd",
            selectable: true
        }, this._options.fullCalendarOptions));
    }

    public addEventSource(source: Calendar_Contracts.IEventSource, options?: FullCalendar.EventSourceOptions, callbacks?: { [callbackType: number]: Function }) {
        this.addEventSources([{ source: source, options: options, callbacks: callbacks }]);
    }

    public addEventSources(sources: SourceAndOptions[]): CalendarEventSource[] {

        sources.forEach((source) => {
            var calendarSource = this._createEventSource(source.source, source.options || {});
            this._calendarSources.push(calendarSource);
            this._element.fullCalendar("addEventSource", calendarSource);

            if (source.callbacks) {
                var callbackTypes = Object.keys(source.callbacks);
                for (var i = 0; i < callbackTypes.length; ++i) {
                    var callbackType: FullCalendarCallbackType = parseInt(callbackTypes[i]);
                    if (callbackType === FullCalendarCallbackType.eventAfterAllRender) {
                        // This callback doesn't make sense for individual events.
                        continue;
                    }
                    this.addCallback(callbackType, this._createFilteredCallback(source.callbacks[callbackTypes[i]],(event) => event["eventType"] === source.source.id));
                }
            }
        });

        return this._calendarSources;
    }

    public getViewQuery(): Calendar_Contracts.IEventQuery {
        var view = this._element.fullCalendar("getView");

        return {
            startDate: Utils_Date.shiftToUTC(new Date(view.start.valueOf())),
            endDate: Utils_Date.shiftToUTC(new Date(view.end.valueOf()))
        };
    }


    public next() : void {
        this._element.fullCalendar("next");
    }

    public prev() : void {
        this._element.fullCalendar("prev");
    }

    public showToday() : void {
        this._element.fullCalendar("today");
    }

    public getFormattedDate(format: string) : string{
        var currentDate : any = this._element.fullCalendar("getDate");
        return currentDate.format(format);
    }

    public renderEvent(event: Calendar_Contracts.CalendarEvent, eventType: string) {
        var end = (<any>$.fullCalendar).moment.parseZone(event.endDate).add(1, 'days').toISOString();
        var calEvent: any  = {
            id: event.id,
            title: event.title,
            allDay: true,
            start: event.startDate,
            end: end,
            eventType: eventType,
            editable: eventType === "freeForm",
            category: event.category
        };

        if (event.__etag) {
            calEvent.__etag = event.__etag;
        }

        if(eventType === 'daysOff'){
            calEvent.member = event.member;
            calEvent.title = event.member.displayName + " Day Off";
        }

        var color = Calendar_ColorUtils.generateColor((<string>event.category || "uncategorized").toLowerCase());
        calEvent.backgroundColor = color;
        calEvent.borderColor = color;

        this._element.fullCalendar("renderEvent", calEvent, false );
    }

     public updateEvent(event: FullCalendar.EventObject) {
        var color = Calendar_ColorUtils.generateColor(((<any>event).category || "uncategorized").toLowerCase());
        event.backgroundColor = color;
        event.borderColor = color;

        this._element.fullCalendar("updateEvent", event);
    }

     public setOption(key: string, value: any) {
        this._element.fullCalendar("option", key, value);
    }
     
    public refreshEvents(eventSource?: FullCalendar.EventSource) {
        if (!eventSource) {
            $('.sprint-label').remove();
            this._element.fullCalendar("refetchEvents");
        }
        else {
            this._element.fullCalendar("removeEventSource", eventSource);
            this._element.fullCalendar("addEventSource", eventSource);
        }
    }

    public removeEvent(id: string) {
        if(id){
            this._element.fullCalendar("removeEvents", id );
        }
    }
    private _viewRender(view: FullCalendar.View, element: JQuery) {
        view["renderId"] = Math.random();
    }

    private _createFilteredCallback(original: (event: FullCalendar.EventObject, element: JQuery, view: FullCalendar.View) => any, filter: (event: FullCalendar.EventObject) => boolean): Function {
        return (event: FullCalendar.EventObject, element: JQuery, view: FullCalendar.View) => {
            if (filter(event)) {
                return original(event, element, view);
            }
        };
    }

    private _createEventSource(source: Calendar_Contracts.IEventSource, options: FullCalendar.EventSourceOptions): CalendarEventSource {
        var state: CalendarEventSourceState = {};

        var getEventsMethod = (start: moment.Moment, end: moment.Moment, timezone: string|boolean, callback: (events: FullCalendar.EventSource) => void) => {

            if (!state.dirty && state.cachedEvents) {
                callback(state.cachedEvents);
                return;
            }
            var getEventsPromise = <Q.Promise<Calendar_Contracts.CalendarEvent[]>> source.getEvents();
            Q.timeout(getEventsPromise, 5000, "Could not load event source " + source.name + ". Request timed out.")
                .then(
                (results) => {
                    var calendarEvents = results.map((value, index) => {
                        //var end = value.endDate ? Utils_Date.addDays(new Date(value.endDate.valueOf()), 1) : value.startDate;
                        var start = (<any>$.fullCalendar).moment.parseZone(value.startDate).stripZone().stripTime().toISOString();
                        var end = value.endDate ? (<any>$.fullCalendar).moment.parseZone(value.endDate).add(1, 'days').stripZone().stripTime().toISOString() : start;
                        var event: any = {
                            id: value.id || Calendar_Utils_Guid.newGuid(),
                            title: value.title,
                            allDay: true,
                            start: start,
                            end: end,
                            eventType: source.id,
                            rendering: options.rendering || '',
                            category: value.category,
                            member: value.member,
                            editable: source.id === "freeForm"
                        };

                        if (value.__etag) {
                            event.__etag = value.__etag;
                        }

                        if ($.isFunction(source.addEvents)) {
                            var color = Calendar_ColorUtils.generateColor((<string>event.category || "uncategorized").toLowerCase());
                            event.backgroundColor = color;
                            event.borderColor = color;
                        }

                        if (options.rendering === "background" && value.category) {
                            var color = Calendar_ColorUtils.generateBackgroundColor((<string>event.category || "uncategorized").toLowerCase());
                            event.backgroundColor = color;
                            event.borderColor = color;
                        }

                        return event;
                    });

                    state.dirty = false;
                    state.cachedEvents = calendarEvents;
                    callback(calendarEvents);

                },(reason) => {
                    console.error(Utils_String.format("Error getting event data.\nEvent source: {0}\nReason: {1}", source.name, reason));
                    callback([]);
                });
        };

        var calendarEventSource: CalendarEventSource = <any>getEventsMethod;
        calendarEventSource.eventSource = source;
        calendarEventSource.state = state;

        return calendarEventSource;
    }

    public addCallback(callbackType: FullCalendarCallbackType, callback: Function) {
        if (!this._callbacks[callbackType]) {
            this._callbacks[callbackType] = [];
        }
        this._callbacks[callbackType].push(callback);
    }

    private _getComposedCallback(callbackType: FullCalendarCallbackType) {
        var args = arguments;
        return (event: FullCalendar.EventObject, element: JQuery, view: FullCalendar.View): JQuery | boolean => {
            var fns = this._callbacks[callbackType];
            if (!fns) {
                return undefined;
            }
            var broken = false;
            var updatedElement = element;
            for (var i = 0; i < fns.length; ++i) {
                var fn = fns[i];

                var result = fn(event, updatedElement, view);
                if (callbackType === FullCalendarCallbackType.eventRender && result === false) {
                    broken = true;
                    break;
                }
                if (callbackType === FullCalendarCallbackType.eventRender && result instanceof jQuery) {
                    updatedElement = result;
                }
            }
            if (broken) {
                return false;
            }
            return updatedElement;
        };
    }

    /**
     * Adds a one-off event directly to the calendar. Consider adding directly to an event 
     * source rather than calling this method.
     * @param FullCalendar.EventObject[] Array of events to add.
     */
    public addEvents(events: FullCalendar.EventObject[]) {
        events.forEach((event) => {
            this._element.fullCalendar("renderEvent", event, true);
        });
    }

    /**
     * Remove events from the calendar
     * @param Array of event IDs to remove, or a filter function, accepting an event, returing true if it is to be removed, false if it is to be kept. Leave null to remove all events.
     * @return EventObject[] - events that were removed.
     */
    public removeEvents(filter: any[]|((event: FullCalendar.EventObject) => boolean)): FullCalendar.EventObject[] {
        var clientEvents = this._element.fullCalendar("clientEvents", filter);
        this._element.fullCalendar("removeEvents", filter);
        return clientEvents;
    }

    /**
     * Gets the current date of the calendar
     @ return Date
     */
    public getDate(): Date {
        return (<moment.Moment><any>this._element.fullCalendar("getDate")).toDate();
    }
}